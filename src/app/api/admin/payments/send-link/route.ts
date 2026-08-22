import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, resolveOrganizationId } from "@/lib/auth";
import { initiatePaymentSchema } from "@/lib/validation";
import { sendPaymentLink } from "@/lib/payments";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  if (!session.externalToken) {
    return NextResponse.json(
      { error: "No Tamasha session token found for this admin. Log out and back in, then retry." },
      { status: 400 }
    );
  }

  const body = await req.json();
  const parsed = initiatePaymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { targetType, targetId } = parsed.data;
  const organizationId = await resolveOrganizationId(session);

  // Verify the target belongs to this admin's organization before acting on it.
  if (targetType === "OBLIGATION") {
    const obligation = await prisma.memberObligation.findUnique({
      where: { id: targetId },
      include: { member: true },
    });
    if (!obligation || (organizationId && obligation.member.organizationId !== organizationId)) {
      return NextResponse.json({ error: "Obligation not found." }, { status: 404 });
    }
  } else {
    const contribution = await prisma.contribution.findUnique({
      where: { id: targetId },
      include: { member: true },
    });
    if (!contribution || (organizationId && contribution.member.organizationId !== organizationId)) {
      return NextResponse.json({ error: "Contribution not found." }, { status: 404 });
    }
  }

  try {
    const transaction = await sendPaymentLink({ targetType, targetId, adminToken: session.externalToken });
    return NextResponse.json({ transaction });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not send payment link.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
