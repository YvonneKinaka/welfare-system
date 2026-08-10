import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { initiatePaymentSchema } from "@/lib/validation";
import { initiatePayment } from "@/lib/payments";

export async function POST(req: NextRequest) {
  const session = await getSession();
  const body = await req.json();
  const parsed = initiatePaymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { targetType, targetId, phone } = parsed.data;

  // Verify the target belongs to the calling member before creating a
  // transaction against it.
  if (targetType === "OBLIGATION") {
    const obligation = await prisma.memberObligation.findUnique({ where: { id: targetId } });
    if (!obligation || obligation.memberId !== session!.id) {
      return NextResponse.json({ error: "Obligation not found." }, { status: 404 });
    }
  } else {
    const contribution = await prisma.contribution.findUnique({ where: { id: targetId } });
    if (!contribution || contribution.memberId !== session!.id) {
      return NextResponse.json({ error: "Contribution not found." }, { status: 404 });
    }
  }

  const member = await prisma.member.findUniqueOrThrow({ where: { id: session!.id } });

  try {
    const transaction = await initiatePayment({
      targetType,
      targetId,
      phone: phone ?? member.phone,
    });
    return NextResponse.json({ transaction }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not initiate payment." }, { status: 400 });
  }
}
