import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { sweepOverdueContributions } from "@/lib/contributions";
import {
  getOrganizationSettings,
  getOrCreateRegistrationObligation,
  getOrCreateCurrentMonthlyObligation,
  effectiveObligationStatus,
} from "@/lib/organizationBilling";

export async function GET() {
  const session = await getSession();
  await sweepOverdueContributions();

  const member = await prisma.member.findUniqueOrThrow({
    where: { id: session!.id },
    include: {
      beneficiaries: true,
      contributions: {
        include: {
          case: {
            include: {
              beneficiary: true,
              contributions: { select: { status: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const active = member.contributions.filter(
    (c) => c.status === "PENDING" && c.case.status === "OPEN"
  );
  const outstanding = member.contributions.filter((c) => c.status === "LAPSED");
  const history = member.contributions.filter((c) => c.status === "PAID");

  // Organization payment settings + this member's current obligations.
  // Null when the member has no organization yet (legacy data), so the UI
  // falls back to the existing welfare-case-only view.
  let settings = null;
  let registration = null;
  let monthly = null;

  if (member.organizationId) {
    settings = await getOrganizationSettings(member.organizationId);
    const rawRegistration = await getOrCreateRegistrationObligation(member.id);
    const rawMonthly = await getOrCreateCurrentMonthlyObligation(member.id);

    registration = rawRegistration
      ? { ...rawRegistration, effectiveStatus: effectiveObligationStatus(rawRegistration, settings.registrationGraceDays) }
      : null;
    monthly = rawMonthly
      ? { ...rawMonthly, effectiveStatus: effectiveObligationStatus(rawMonthly, settings.monthlyGraceDays ?? 0) }
      : null;
  }

  return NextResponse.json({ member, active, outstanding, history, settings, registration, monthly });
}
