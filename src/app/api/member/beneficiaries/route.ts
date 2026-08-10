import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { memberCreateBeneficiarySchema } from "@/lib/validation";
import { BeneficiaryStatus } from "@/lib/enums";

export async function POST(req: NextRequest) {
  const session = await getSession();
  const body = await req.json();
  const parsed = memberCreateBeneficiarySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  // Status is never taken from the client - every member submission starts
  // as PENDING_APPROVAL and only an admin can move it to ACTIVE/REJECTED.
  const beneficiary = await prisma.beneficiary.create({
    data: {
      memberId: session!.id,
      fullName: parsed.data.fullName,
      relationship: parsed.data.relationship,
      phone: parsed.data.phone,
      status: BeneficiaryStatus.PENDING_APPROVAL,
    },
  });

  return NextResponse.json({ beneficiary }, { status: 201 });
}
