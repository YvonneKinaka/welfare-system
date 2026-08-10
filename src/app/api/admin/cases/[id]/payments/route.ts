import { NextRequest, NextResponse } from "next/server";
import { recordPaymentSchema } from "@/lib/validation";
import { recordPayment } from "@/lib/contributions";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  const body = await req.json();
  const parsed = recordPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const contribution = await recordPayment({
      caseId: params.id,
      memberId: parsed.data.memberId,
      recordedById: session!.id,
    });
    return NextResponse.json({ contribution });
  } catch {
    return NextResponse.json({ error: "Could not record payment." }, { status: 400 });
  }
}
