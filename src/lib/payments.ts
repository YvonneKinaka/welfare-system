import crypto from "crypto";
import { prisma } from "@/lib/db";
import { recordPayment as recordWelfareContributionPayment } from "@/lib/contributions";
import { recordObligationPayment } from "@/lib/organizationBilling";
import { dispatchNotification } from "@/lib/notifications";

/**
 * PAYMENT TRANSACTIONS
 * --------------------
 * This is the foundation for a future real payment provider (e.g. M-Pesa
 * Daraja) - no provider is connected yet. `initiatePayment` creates a
 * PENDING transaction and returns it as a mock response; a real
 * integration would call the provider here instead and likely return a
 * PROCESSING transaction. `handlePaymentCallback` is what a provider's
 * webhook would call to report the final outcome; for now it can be
 * called directly (e.g. from an admin tool or a test request) to simulate
 * that webhook.
 *
 * A transaction always targets exactly one of:
 *  - a MemberObligation (registration, annual renewal, monthly contribution)
 *  - a welfare Contribution (the existing ContributionCase flow)
 * Marking either PAID reuses the exact same functions the manual admin
 * "record payment" actions already use, so suspension/reactivation and
 * every other side effect of a real payment stay identical either way.
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

  // Mock response - no real provider call yet, just a PENDING record a
  // future integration can drive forward via the callback below.
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
    if (updated.obligationId) {
      await recordObligationPayment(updated.obligationId, null, updated.reference);
    } else if (updated.contributionId) {
      const contribution = await prisma.contribution.findUniqueOrThrow({
        where: { id: updated.contributionId },
      });
      await recordWelfareContributionPayment({
        caseId: contribution.caseId,
        memberId: contribution.memberId,
        recordedById: null,
        paymentReference: updated.reference,
      });
    }
  } else if (opts.status === "FAILED") {
    const member = updated.obligationId
      ? (await prisma.memberObligation.findUnique({ where: { id: updated.obligationId }, include: { member: true } }))
          ?.member
      : updated.contributionId
        ? (await prisma.contribution.findUnique({ where: { id: updated.contributionId }, include: { member: true } }))
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
        message: `Your payment of KSh ${updated.amount} could not be completed.`,
        paymentReference: updated.reference,
      });
    }
  }

  return updated;
}

export async function getPaymentStatus(reference: string) {
  return prisma.paymentTransaction.findUnique({ where: { reference } });
}
