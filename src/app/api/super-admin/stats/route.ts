import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const [totalOrganizations, totalAdmins, totalMembers, paidContributions] = await Promise.all([
    prisma.organization.count(),
    prisma.admin.count({ where: { role: "ORG_ADMIN" } }),
    prisma.member.count(),
    prisma.contribution.findMany({ where: { status: "PAID" }, select: { amount: true } }),
  ]);

  const totalWelfareCollected = paidContributions.reduce((sum, c) => sum + c.amount, 0);

  return NextResponse.json({
    totalOrganizations,
    totalAdmins,
    totalMembers,
    totalWelfareCollected,
  });
}
