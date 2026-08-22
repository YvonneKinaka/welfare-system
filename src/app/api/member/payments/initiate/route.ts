import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { initiatePaymentSchema } from "@/lib/validation";
import { getLatestTransactionForTarget, initiatePayment } from "@/lib/payments";
import { tamashaCreateMemberPaymentLink } from "@/lib/tamashaClient";

/**
 * Members can initiate their own payment link. Tamasha authorizes this
 * through the authenticated member-only payment-link endpoint; the Welfare
 * app never uses an admin token on behalf of a member.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "MEMBER") {
    return NextResponse.json({ error: "Not authenticated as a member." }, { status: 401 });
  }
  const body = await req.json();
  const parsed = initiatePaymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { targetType, targetId } = parsed.data;

  let targetMember: { id: string; phone: string; tamashaUserId: number | null; email: string | null } | null = null;
  let amount: number;
  let description: string;

  // Verify the target belongs to the calling member before creating anything.
  if (targetType === "OBLIGATION") {
    const obligation = await prisma.memberObligation.findUnique({ where: { id: targetId }, include: { member: true } });
    if (!obligation || obligation.memberId !== session!.id) {
      return NextResponse.json({ error: "Obligation not found." }, { status: 404 });
    }
    targetMember = obligation.member;
    amount = obligation.amount;
    description = `${obligation.type.replace(/_/g, " ").toLowerCase()} - ${obligation.periodLabel ?? ""}`.trim();
  } else {
    const contribution = await prisma.contribution.findUnique({ where: { id: targetId }, include: { member: true, case: { include: { beneficiary: true } } } });
    if (!contribution || contribution.memberId !== session!.id) {
      return NextResponse.json({ error: "Contribution not found." }, { status: 404 });
    }
    targetMember = contribution.member;
    amount = contribution.amount;
    description = `Welfare contribution for ${contribution.case.beneficiary.fullName}`;
  }

  if (!targetMember.tamashaUserId || !session.externalToken) {
    return NextResponse.json({ error: "This member is not linked to Tamasha yet." }, { status: 409 });
  }

  let transaction = await getLatestTransactionForTarget({ targetType, targetId });
  if (!transaction || transaction.status === "FAILED") {
    transaction = await initiatePayment({ targetType, targetId, phone: targetMember.phone });
  }

  if (!transaction.tamashaPaymentUrl && transaction.status !== "PAID") {
    const tamashaResult = await tamashaCreateMemberPaymentLink(session.externalToken, {
      tamashaUserId: targetMember.tamashaUserId,
      externalReference: transaction.reference,
      amount,
      description,
    });

    if (!tamashaResult.success) {
      return NextResponse.json({ transaction, error: tamashaResult.error }, { status: 502 });
    }

    transaction = await prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: { tamashaPaymentUrl: tamashaResult.paymentUrl },
    });
  }

  return NextResponse.json({ transaction }, { status: 201 });
}
