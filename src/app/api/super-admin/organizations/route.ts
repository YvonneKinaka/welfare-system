import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createOrganizationSchema } from "@/lib/validation";

export async function GET() {
  const organizations = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { admins: true } } },
  });
  return NextResponse.json({ organizations });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = createOrganizationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const memberIdPrefix =
    parsed.data.memberIdPrefix?.toUpperCase() ||
    parsed.data.name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() ||
    "MEM";

  const organization = await prisma.organization.create({
    data: { name: parsed.data.name, memberIdPrefix },
  });
  return NextResponse.json({ organization }, { status: 201 });
}
