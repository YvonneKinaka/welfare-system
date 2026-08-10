import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { updateBeneficiarySchema } from "@/lib/validation";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const parsed = updateBeneficiarySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const openCase = await prisma.contributionCase.findFirst({
    where: { beneficiaryId: params.id, status: "OPEN" },
  });
  if (parsed.data.status === "ARCHIVED" && openCase) {
    return NextResponse.json(
      { error: "Cannot archive a beneficiary with an open contribution case." },
      { status: 409 }
    );
  }

  const beneficiary = await prisma.beneficiary.update({ where: { id: params.id }, data: parsed.data });
  return NextResponse.json({ beneficiary });
}
