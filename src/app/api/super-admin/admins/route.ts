import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { createOrgAdminSchema } from "@/lib/validation";
import { AdminRole } from "@/lib/enums";

export async function GET() {
  const admins = await prisma.admin.findMany({
    where: { role: AdminRole.ORG_ADMIN },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fullName: true,
      email: true,
      status: true,
      createdAt: true,
      organization: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json({ admins });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = createOrgAdminSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const existing = await prisma.admin.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return NextResponse.json({ error: "An admin with this email already exists." }, { status: 409 });
  }

  const organization = await prisma.organization.findUnique({
    where: { id: parsed.data.organizationId },
  });
  if (!organization) {
    return NextResponse.json({ error: "Organization not found." }, { status: 404 });
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const admin = await prisma.admin.create({
    data: {
      fullName: parsed.data.fullName,
      email: parsed.data.email,
      passwordHash,
      role: AdminRole.ORG_ADMIN,
      organizationId: parsed.data.organizationId,
    },
  });

  return NextResponse.json({ admin: { id: admin.id, fullName: admin.fullName, email: admin.email } }, { status: 201 });
}
