import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { generateMemberStatement } from "@/lib/pdf";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  const member = await prisma.member.findUniqueOrThrow({ where: { id: session!.id } });
  const pdf = await generateMemberStatement(session!.id);

  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${member.membershipNumber}-statement.pdf"`,
    },
  });
}
