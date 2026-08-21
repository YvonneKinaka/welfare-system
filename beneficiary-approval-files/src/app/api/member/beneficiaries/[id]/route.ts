import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { memberUpdateBeneficiarySchema } from "@/lib/validation";
import { BeneficiaryStatus } from "@/lib/enums";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  const body = await req.json();
  const parsed = memberUpdateBeneficiarySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const existing = await prisma.beneficiary.findUnique({ where: { id: params.id } });
  if (!existing || existing.memberId !== session!.id) {
    return NextResponse.json({ error: "Beneficiary not found." }, { status: 404 });
  }

  if (existing.status === BeneficiaryStatus.ACTIVE || existing.status === BeneficiaryStatus.ARCHIVED) {
    return NextResponse.json(
      { error: "Only a pending or rejected beneficiary can be edited and resubmitted." },
      { status: 409 }
    );
  }

  // Editing always resubmits for approval, even if it was previously rejected.
  const beneficiary = await prisma.beneficiary.update({
    where: { id: params.id },
    data: {
      fullName: parsed.data.fullName,
      relationship: parsed.data.relationship,
      phone: parsed.data.phone,
      status: BeneficiaryStatus.PENDING_APPROVAL,
    },
  });

  return NextResponse.json({ beneficiary });
}
