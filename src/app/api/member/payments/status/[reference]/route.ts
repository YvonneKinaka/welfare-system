import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getPaymentStatus } from "@/lib/payments";

export async function GET(_req: NextRequest, { params }: { params: { reference: string } }) {
  const session = await getSession();
  const transaction = await getPaymentStatus(params.reference);
  if (!transaction) {
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  }

  let ownerId: string | null = null;
  if (transaction.obligationId) {
    const obligation = await prisma.memberObligation.findUnique({ where: { id: transaction.obligationId } });
    ownerId = obligation?.memberId ?? null;
  } else if (transaction.contributionId) {
    const contribution = await prisma.contribution.findUnique({ where: { id: transaction.contributionId } });
    ownerId = contribution?.memberId ?? null;
  }

  if (ownerId !== session!.id) {
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  }

  return NextResponse.json({ transaction });
}
