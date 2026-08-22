import { NextRequest, NextResponse } from "next/server";
import { generateCaseReport } from "@/lib/pdf";
import { prisma } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const c = await prisma.contributionCase.findUnique({
    where: { id: params.id },
    include: { beneficiary: true },
  });
  if (!c) return NextResponse.json({ error: "Case not found." }, { status: 404 });

  const pdf = await generateCaseReport(params.id);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${c.beneficiary.fullName.replace(/\s+/g, "-")}-case-report.pdf"`,
    },
  });
}
