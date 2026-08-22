import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { updateMemberSchema } from "@/lib/validation";
import { getSession } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  const member = await prisma.member.findUnique({
    where: { id: params.id },
    include: {
      beneficiaries: true,
      contributions: { include: { case: { include: { beneficiary: true } } } },
      obligations: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!member) return NextResponse.json({ error: "Member not found." }, { status: 404 });
  if (session?.organizationId && member.organizationId && member.organizationId !== session.organizationId) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  return NextResponse.json({ member });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const parsed = updateMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const data = { ...parsed.data };
  if (data.email === "") data.email = undefined;

  // Manually setting status resets the miss counter, giving admins a clean
  // way to reinstate a member outside the automatic clearance flow.
  const updateData: Record<string, unknown> = { ...data };
  if (data.status === "ACTIVE") updateData.missedCount = 0;

  const member = await prisma.member.update({ where: { id: params.id }, data: updateData });
  return NextResponse.json({ member });
}
