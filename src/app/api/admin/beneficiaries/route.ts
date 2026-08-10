import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createBeneficiarySchema } from "@/lib/validation";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSession();
  const memberId = req.nextUrl.searchParams.get("memberId");
  const status = req.nextUrl.searchParams.get("status");
  const beneficiaries = await prisma.beneficiary.findMany({
    where: {
      ...(memberId ? { memberId } : {}),
      ...(status ? { status } : {}),
      ...(session?.organizationId ? { member: { organizationId: session.organizationId } } : {}),
    },
    include: { member: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ beneficiaries });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = createBeneficiarySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const member = await prisma.member.findUnique({ where: { id: parsed.data.memberId } });
  if (!member) return NextResponse.json({ error: "Member not found." }, { status: 404 });

  const beneficiary = await prisma.beneficiary.create({ data: parsed.data });
  return NextResponse.json({ beneficiary }, { status: 201 });
}
