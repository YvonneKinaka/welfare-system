import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { updateOrgAdminSchema } from "@/lib/validation";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const parsed = updateOrgAdminSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const admin = await prisma.admin.update({ where: { id: params.id }, data: parsed.data });
  return NextResponse.json({
    admin: { id: admin.id, fullName: admin.fullName, email: admin.email, status: admin.status },
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.admin.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
