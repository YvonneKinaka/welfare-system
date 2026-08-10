import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { recordObligationPayment } from "@/lib/organizationBilling";

export async function PATCH(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  try {
    const obligation = await recordObligationPayment(params.id, session!.id);
    return NextResponse.json({ obligation });
  } catch {
    return NextResponse.json({ error: "Could not record payment." }, { status: 400 });
  }
}
