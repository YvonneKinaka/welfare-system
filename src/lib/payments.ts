import crypto from "crypto";
import { prisma } from "@/lib/db";
import { recordPayment as recordWelfareContributionPayment } from "@/lib/contributions";
import { recordObligationPayment } from "@/lib/organizationBilling";
import { dispatchNotification } from "@/lib/notifications";
import { tamashaCreatePaymentLink, tamashaConfirmPayment } from "@/lib/tamashaClient";

/**
 * PAYMENT TRANSACTIONS
 * --------------------
 * A transaction always targets exactly one of:
 *  - a MemberObligation (registration, annual renewal, monthly contribution)
 *  - a welfare Contribution (the existing ContributionCase flow)
 *
 * Phase 3: real Tamasha payment links + reconciliation.
 *  - sendPaymentLink() (admin-triggered, uses the admin's own Tamasha
 *    token) creates/reuses a local PENDING transaction and asks Tamasha to
 *    email/SMS the member a real checkout link. This never marks anything
 *    PAID - it only records that a link was sent.
 *  - reconcilePaymentTransaction() is the ONLY function that can move a
 *    transaction to PAID or FAILED, and only based on Tamasha's real
 *    POST /welfare/payments/confirm response - never on the notify call's
 *    success.
 *  - handlePaymentCallback() below is the original mock/placeholder
 *    webhook handler from before Tamasha was integrated. It is kept as-is
 *    and unused for Tamasha - no real webhook is documented, so nothing
 *    calls this for real payments. Its PAID/FAILED handling now shares the
 *    same applyPaidOutcome/applyFailedOutcome helpers as reconciliation,
 *    so the actual "mark it paid" logic is defined once, not duplicated.
 */

function generateReference(): string {
  return `PAY-${crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
}

export async function initiatePayment(opts: {
  targetType: "OBLIGATION" | "WELFARE_CONTRIBUTION";
  targetId: string;
  phone: string;
}) {
  let amount: number;

  if (opts.targetType === "OBLIGATION") {
    const obligation = await prisma.memberObligation.findUniqueOrThrow({ where: { id: opts.targetId } });
    amount = obligation.amount;
  } else {
    const contribution = await prisma.contribution.findUniqueOrThrow({ where: { id: opts.targetId } });
    amount = contribution.amount;
  }

  return prisma.paymentTransaction.create({
    data: {
      reference: generateReference(),
      amount,
      phone: opts.phone,
      status: "PENDING",
      obligationId: opts.targetType === "OBLIGATION" ? opts.targetId : null,
      contributionId: opts.targetType === "WELFARE_CONTRIBUTION" ? opts.targetId : null,
    },
  });
}

/** Returns the most recent transaction for a target, if any - read-only, creates nothing. */
export async function getLatestTransactionForTarget(opts: {
  targetType: "OBLIGATION" | "WELFARE_CONTRIBUTION";
  targetId: string;
}) {
  return prisma.paymentTransaction.findFirst({
    where:
      opts.targetType === "OBLIGATION" ? { obligationId: opts.targetId } : { contributionId: opts.targetId },
    orderBy: { createdAt: "desc" },
  });
}

// ---------------------------------------------------------------------
// Shared PAID/FAILED side effects - the single definition of "what
// happens when a payment is confirmed paid/failed", used by both the
// legacy mock callback and the real Tamasha reconciliation path.
// ---------------------------------------------------------------------

async function applyPaidOutcome(transaction: { id: string; obligationId: string | null; contributionId: string | null; reference: string }) {
  if (transaction.obligationId) {
    await recordObligationPayment(transaction.obligationId, null, transaction.reference);
  } else if (transaction.contributionId) {
    const contribution = await prisma.contribution.findUniqueOrThrow({
      where: { id: transaction.contributionId },
    });
    await recordWelfareContributionPayment({
      caseId: contribution.caseId,
      memberId: contribution.memberId,
      recordedById: null,
      paymentReference: transaction.reference,
    });
  }
}

async function applyFailedOutcome(transaction: {
  obligationId: string | null;
  contributionId: string | null;
  reference: string;
  amount: number;
}) {
  const member = transaction.obligationId
    ? (await prisma.memberObligation.findUnique({ where: { id: transaction.obligationId }, include: { member: true } }))
        ?.member
    : transaction.contributionId
      ? (await prisma.contribution.findUnique({ where: { id: transaction.contributionId }, include: { member: true } }))
          ?.member
      : null;

  if (member) {
    await dispatchNotification({
      recipientType: "MEMBER",
      recipientId: member.id,
      channel: member.email ? "EMAIL" : "SMS",
      type: "PAYMENT_FAILED",
      to: member.email ?? member.phone,
      subject: "Payment failed",
      message: `Your payment of KSh ${transaction.amount} could not be completed.`,
      paymentReference: transaction.reference,
    });
  }
}

// ---------------------------------------------------------------------
// Legacy mock callback handler - kept exactly as it was, unused for real
// Tamasha payments (no webhook is documented). Left in place only so
// nothing that referenced it before breaks.
// ---------------------------------------------------------------------

export async function handlePaymentCallback(opts: {
  reference: string;
  status: "PROCESSING" | "PAID" | "FAILED";
  providerTransactionId?: string;
}) {
  const transaction = await prisma.paymentTransaction.findUnique({ where: { reference: opts.reference } });
  if (!transaction) return null;

  const isFinal = opts.status === "PAID" || opts.status === "FAILED";
  const updated = await prisma.paymentTransaction.update({
    where: { id: transaction.id },
    data: {
      status: opts.status,
      providerTransactionId: opts.providerTransactionId ?? transaction.providerTransactionId,
      completedAt: isFinal ? new Date() : null,
    },
  });

  if (opts.status === "PAID") {
    await applyPaidOutcome(updated);
  } else if (opts.status === "FAILED") {
    await applyFailedOutcome(updated);
  }

  return updated;
}

export async function getPaymentStatus(reference: string) {
  return prisma.paymentTransaction.findUnique({ where: { reference } });
}

// ---------------------------------------------------------------------
// Phase 3: real Tamasha payment link + reconciliation
// ---------------------------------------------------------------------

/**
 * Admin-triggered: creates/reuses a local PENDING transaction for a
 * member's outstanding obligation or welfare contribution, then asks
 * Tamasha to email/SMS them a real checkout link. Requires the member to
 * already be linked to Tamasha (Phase 2's tamashaUserId) - there is no
 * way to send a Tamasha payment link to an unlinked member.
 *
 * This never marks anything PAID - a successful call here only means the
 * link was created/sent, exactly as instructed.
 */
export async function sendPaymentLink(opts: {
  targetType: "OBLIGATION" | "WELFARE_CONTRIBUTION";
  targetId: string;
  adminToken: string;
}) {
  let amount: number;
  let phone: string;
  let tamashaUserId: number | null;
  let description: string;

  if (opts.targetType === "OBLIGATION") {
    const obligation = await prisma.memberObligation.findUniqueOrThrow({
      where: { id: opts.targetId },
      include: { member: true },
    });
    amount = obligation.amount;
    phone = obligation.member.phone;
    tamashaUserId = obligation.member.tamashaUserId;
    description = `${obligation.type.replace(/_/g, " ").toLowerCase()} - ${obligation.periodLabel ?? ""}`.trim();
  } else {
    const contribution = await prisma.contribution.findUniqueOrThrow({
      where: { id: opts.targetId },
      include: { member: true, case: { include: { beneficiary: true } } },
    });
    amount = contribution.amount;
    phone = contribution.member.phone;
    tamashaUserId = contribution.member.tamashaUserId;
    description = `Welfare contribution for ${contribution.case.beneficiary.fullName}`;
  }

  if (!tamashaUserId) {
    throw new Error("This member is not linked to Tamasha yet - link them from their member page first.");
  }

  // Reuse an existing PENDING transaction for this target if one already
  // exists, instead of creating duplicates every time a link is (re)sent.
  let transaction = await getLatestTransactionForTarget(opts);
  if (!transaction || transaction.status !== "PENDING") {
    transaction = await initiatePayment({ targetType: opts.targetType, targetId: opts.targetId, phone });
  }

  const result = await tamashaCreatePaymentLink(opts.adminToken, {
    tamashaUserId,
    externalReference: transaction.reference,
    amount,
    description,
  });

  if (!result.success) {
    throw new Error(result.error);
  }

  return prisma.paymentTransaction.update({
    where: { id: transaction.id },
    data: { tamashaPaymentUrl: result.paymentUrl },
  });
}

/**
 * Admin-triggered: the ONLY path in this app that can mark a transaction
 * PAID or FAILED for a real Tamasha payment, and only based on Tamasha's
 * actual POST /welfare/payments/confirm response.status - never on
 * whether the API request itself succeeded.
 */
export async function reconcilePaymentTransaction(transactionId: string, adminToken: string) {
  const transaction = await prisma.paymentTransaction.findUniqueOrThrow({ where: { id: transactionId } });

  // Already settled - idempotent, does not re-confirm or re-apply effects.
  if (transaction.status === "PAID" || transaction.status === "FAILED") {
    return transaction;
  }

  const result = await tamashaConfirmPayment(adminToken, {
    checkoutRequestId: transaction.tamashaCheckoutRequestId ?? undefined,
    welfareReference: transaction.reference,
  });

  if (!result.success) {
    throw new Error(result.error);
  }

  const isFinal = result.status === "PAID" || result.status === "FAILED";
  const updated = await prisma.paymentTransaction.update({
    where: { id: transaction.id },
    data: {
      status: result.status,
      providerTransactionId: result.providerTransactionId ?? transaction.providerTransactionId,
      completedAt: isFinal ? new Date() : null,
    },
  });

  if (result.status === "PAID") {
    await applyPaidOutcome(updated);
  } else if (result.status === "FAILED") {
    await applyFailedOutcome(updated);
  }

  return updated;
}
