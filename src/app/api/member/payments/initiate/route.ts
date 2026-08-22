import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { initiatePaymentSchema } from "@/lib/validation";
import { getLatestTransactionForTarget } from "@/lib/payments";

/**
 * Read-only lookup, not a payment action. Members can no longer
 * self-initiate a Tamasha payment link (POST /welfare/payment-links/notify
 * requires an admin-level Tamasha token, which members don't have) - see
 * the Phase 3 write-up. This endpoint now just returns whatever real
 * transaction/payment link an admin has already sent for this target, so
 * PayNowButton can show it, without ever creating or faking one itself.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  const body = await req.json();
  const parsed = initiatePaymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { targetType, targetId } = parsed.data;

  // Verify the target belongs to the calling member before returning anything.
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

  const transaction = await getLatestTransactionForTarget({ targetType, targetId });
  return NextResponse.json({ transaction });
}
