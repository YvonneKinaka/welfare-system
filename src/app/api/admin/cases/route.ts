import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createCaseSchema } from "@/lib/validation";
import { openContributionCase, sweepOverdueContributions } from "@/lib/contributions";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  await sweepOverdueContributions();
  const cases = await prisma.contributionCase.findMany({
    where: session?.organizationId
      ? { affectedMember: { organizationId: session.organizationId } }
      : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      beneficiary: true,
      affectedMember: true,
      contributions: true,
    },
  });

  const withProgress = cases.map((c) => {
    const expected = c.contributions.length * c.amountPerMember;
    const collected = c.contributions.filter((x) => x.status === "PAID").length * c.amountPerMember;
    return { ...c, expected, collected, remaining: expected - collected };
  });

  return NextResponse.json({ cases: withProgress });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const body = await req.json();
  const parsed = createCaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const contributionCase = await openContributionCase({
      beneficiaryId: parsed.data.beneficiaryId,
      deadline: new Date(parsed.data.deadline),
      createdById: session!.id,
      notes: parsed.data.notes,
    });
    return NextResponse.json({ case: contributionCase }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not open case.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
