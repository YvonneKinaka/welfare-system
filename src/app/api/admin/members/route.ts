import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createMemberSchema } from "@/lib/validation";
import { generateMembershipNumber } from "@/lib/contributions";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  const members = await prisma.member.findMany({
    where: session?.organizationId ? { organizationId: session.organizationId } : undefined,
    orderBy: { createdAt: "desc" },
    include: { beneficiaries: true, _count: { select: { contributions: true } } },
  });
  return NextResponse.json({ members });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const body = await req.json();
  const parsed = createMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { fullName, phone, email } = parsed.data;

  const existing = await prisma.member.findFirst({
    where: { OR: [{ phone }, ...(email ? [{ email }] : [])] },
  });
  if (existing) {
    return NextResponse.json(
      { error: "A member with this phone number or email already exists." },
      { status: 409 }
    );
  }

  const organizationId = session?.organizationId ?? null;
  const membershipNumber = await generateMembershipNumber(organizationId);
  const member = await prisma.member.create({
    data: { fullName, phone, email: email || null, membershipNumber, organizationId },
  });

  return NextResponse.json({ member }, { status: 201 });
}
