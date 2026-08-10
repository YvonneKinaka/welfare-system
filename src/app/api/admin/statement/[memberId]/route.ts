import { NextRequest, NextResponse } from "next/server";
import { generateMemberStatement } from "@/lib/pdf";
import { prisma } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { memberId: string } }) {
  const member = await prisma.member.findUnique({ where: { id: params.memberId } });
  if (!member) return NextResponse.json({ error: "Member not found." }, { status: 404 });

  const pdf = await generateMemberStatement(params.memberId);
  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${member.membershipNumber}-statement.pdf"`,
    },
  });
}
