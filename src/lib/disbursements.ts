import crypto from "crypto";
import { prisma } from "@/lib/db";
import { dispatchNotification } from "@/lib/notifications";

/**
 * DISBURSEMENTS
 * -------------
 * Organization-scoped wallet + a multi-approver release flow:
 *   1. Admin submits a disbursement -> PENDING, no funds move yet.
 *   2. One DisbursementApproval row (with its own secret token) is created
 *      per configured approver email, and each approver is emailed a link.
 *      Approvers have no account - the token alone is their access.
 *   3. Any REJECTED decision immediately rejects the whole disbursement.
 *   4. Once enough APPROVED decisions are in (>= the snapshot minApprovals
 *      taken at submission time), the wallet is debited automatically and
 *      the disbursement becomes APPROVED - "funds released" and "wallet
 *      updated" happen together, in the same step.
 *   5. COMPLETED is a separate, later, manual admin action confirming the
 *      real-world bank/mobile-money payout actually happened - no real
 *      payment rail is connected yet, so this mirrors how every other
 *      payment in this app is manually confirmed by an admin.
 */

function appUrl(): string {
  return process.env.APP_URL || "http://localhost:3000";
}

export async function getOrCreateWallet(organizationId: string) {
  const existing = await prisma.wallet.findUnique({ where: { organizationId } });
  if (existing) return existing;
  return prisma.wallet.create({ data: { organizationId } });
}

export async function getWalletSummary(organizationId: string) {
  const wallet = await getOrCreateWallet(organizationId);
  const pending = await prisma.disbursement.findMany({
    where: { organizationId, status: "PENDING" },
    select: { amount: true },
  });

  return {
    wallet,
    pendingCount: pending.length,
    pendingTotal: pending.reduce((sum, d) => sum + d.amount, 0),
  };
}

export async function recordDeposit(opts: {
  organizationId: string;
  amount: number;
  note?: string;
  recordedById: string;
}) {
  const wallet = await getOrCreateWallet(opts.organizationId);

  const [deposit] = await prisma.$transaction([
    prisma.walletDeposit.create({
      data: { walletId: wallet.id, amount: opts.amount, note: opts.note, recordedById: opts.recordedById },
    }),
    prisma.wallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: opts.amount }, totalReceived: { increment: opts.amount } },
    }),
  ]);

  return deposit;
}

export async function getApprovalSettings(organizationId: string) {
  const existing = await prisma.disbursementApprovalSettings.findUnique({ where: { organizationId } });
  if (!existing) return { approverEmails: [] as string[], minApprovals: 1 };
  return { approverEmails: JSON.parse(existing.approverEmails) as string[], minApprovals: existing.minApprovals };
}

export async function upsertApprovalSettings(
  organizationId: string,
  data: { approverEmails: string[]; minApprovals: number }
) {
  const payload = { approverEmails: JSON.stringify(data.approverEmails), minApprovals: data.minApprovals };
  const settings = await prisma.disbursementApprovalSettings.upsert({
    where: { organizationId },
    update: payload,
    create: { organizationId, ...payload },
  });
  return { approverEmails: data.approverEmails, minApprovals: settings.minApprovals };
}

export async function createDisbursement(opts: {
  organizationId: string;
  recipientName: string;
  amount: number;
  paymentMethod: "BANK" | "MOBILE_MONEY";
  accountNumber: string;
  comment?: string;
  requestedById: string;
}) {
  const wallet = await getOrCreateWallet(opts.organizationId);
  if (wallet.balance < opts.amount) {
    throw new Error("Insufficient wallet balance for this disbursement.");
  }

  const { approverEmails, minApprovals } = await getApprovalSettings(opts.organizationId);
  if (approverEmails.length === 0) {
    throw new Error("Configure at least one approver before submitting a disbursement.");
  }

  const disbursement = await prisma.disbursement.create({
    data: {
      organizationId: opts.organizationId,
      walletId: wallet.id,
      recipientName: opts.recipientName,
      amount: opts.amount,
      paymentMethod: opts.paymentMethod,
      accountNumber: opts.accountNumber,
      comment: opts.comment,
      minApprovals,
      requestedById: opts.requestedById,
      approvals: {
        create: approverEmails.map((email) => ({
          approverEmail: email,
          token: crypto.randomBytes(24).toString("hex"),
        })),
      },
    },
    include: { approvals: true },
  });

  for (const approval of disbursement.approvals) {
    const link = `${appUrl()}/disbursements/approve/${approval.token}`;
    await dispatchNotification({
      recipientType: "EXTERNAL",
      recipientId: approval.approverEmail,
      channel: "EMAIL",
      type: "DISBURSEMENT_APPROVAL_REQUEST",
      to: approval.approverEmail,
      subject: "Disbursement approval requested",
      message: `A disbursement of KSh ${opts.amount} to ${opts.recipientName} (${opts.paymentMethod === "BANK" ? "bank" : "mobile money"}: ${opts.accountNumber}) needs your approval. Review and respond here: ${link}`,
    });
  }

  return disbursement;
}

export async function getDisbursementApprovalByToken(token: string) {
  return prisma.disbursementApproval.findUnique({
    where: { token },
    include: { disbursement: { include: { approvals: true } } },
  });
}

/**
 * Records one approver's decision. Rejecting immediately rejects the whole
 * disbursement. Approving checks whether enough approvals are now in - if
 * so, the wallet is debited and the disbursement is marked APPROVED in the
 * same step. Safe against re-submission: an approval that has already been
 * responded to, or a disbursement that is no longer PENDING, is refused.
 */
export async function decideDisbursementApproval(opts: {
  token: string;
  decision: "APPROVED" | "REJECTED";
  comment?: string;
}) {
  const approval = await prisma.disbursementApproval.findUnique({
    where: { token: opts.token },
    include: { disbursement: true },
  });
  if (!approval) throw new Error("This approval link is invalid.");
  if (approval.status !== "PENDING") throw new Error("This approval has already been submitted.");
  if (approval.disbursement.status !== "PENDING") {
    throw new Error("This disbursement has already been decided.");
  }

  await prisma.disbursementApproval.update({
    where: { id: approval.id },
    data: { status: opts.decision, comment: opts.comment, respondedAt: new Date() },
  });

  if (opts.decision === "REJECTED") {
    await prisma.disbursement.update({
      where: { id: approval.disbursementId },
      data: { status: "REJECTED", decidedAt: new Date() },
    });
    return { disbursementStatus: "REJECTED" as const };
  }

  const approvedCount = await prisma.disbursementApproval.count({
    where: { disbursementId: approval.disbursementId, status: "APPROVED" },
  });

  if (approvedCount >= approval.disbursement.minApprovals) {
    // Release funds and update the wallet balance automatically, in the
    // same transaction as marking the disbursement approved.
    await prisma.$transaction([
      prisma.wallet.update({
        where: { id: approval.disbursement.walletId },
        data: {
          balance: { decrement: approval.disbursement.amount },
          totalDisbursed: { increment: approval.disbursement.amount },
        },
      }),
      prisma.disbursement.update({
        where: { id: approval.disbursementId },
        data: { status: "APPROVED", decidedAt: new Date() },
      }),
    ]);
    return { disbursementStatus: "APPROVED" as const };
  }

  return { disbursementStatus: "PENDING" as const };
}

export async function markDisbursementCompleted(disbursementId: string) {
  const disbursement = await prisma.disbursement.findUniqueOrThrow({ where: { id: disbursementId } });
  if (disbursement.status !== "APPROVED") {
    throw new Error("Only an approved disbursement can be marked completed.");
  }
  return prisma.disbursement.update({
    where: { id: disbursementId },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
}

export async function listDisbursements(organizationId: string) {
  return prisma.disbursement.findMany({
    where: { organizationId },
    include: { approvals: true, requestedBy: true },
    orderBy: { createdAt: "desc" },
  });
}
