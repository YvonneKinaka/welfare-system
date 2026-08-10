import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sweepOverdueContributions } from "@/lib/contributions";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  const orgFilter = session?.organizationId ? { organizationId: session.organizationId } : undefined;
  const memberOrgFilter = session?.organizationId
    ? { member: { organizationId: session.organizationId } }
    : undefined;

  await sweepOverdueContributions();

  const [totalMembers, activeMembers, suspendedMembers, openCases, closedCases, contributions] =
    await Promise.all([
      prisma.member.count({ where: orgFilter }),
      prisma.member.count({ where: { ...orgFilter, status: "ACTIVE" } }),
      prisma.member.count({ where: { ...orgFilter, status: "SUSPENDED" } }),
      prisma.contributionCase.count({
        where: { status: "OPEN", ...(orgFilter ? { affectedMember: orgFilter } : {}) },
      }),
      prisma.contributionCase.count({
        where: { status: "CLOSED", ...(orgFilter ? { affectedMember: orgFilter } : {}) },
      }),
      prisma.contribution.findMany({
        where: memberOrgFilter,
        select: { amount: true, status: true },
      }),
    ]);

  const amountExpected = contributions.reduce((sum, c) => sum + c.amount, 0);
  const amountCollected = contributions
    .filter((c) => c.status === "PAID")
    .reduce((sum, c) => sum + c.amount, 0);
  const outstanding = amountExpected - amountCollected;

  return NextResponse.json({
    totalMembers,
    activeMembers,
    suspendedMembers,
    openCases,
    closedCases,
    amountExpected,
    amountCollected,
    outstanding,
  });
}
