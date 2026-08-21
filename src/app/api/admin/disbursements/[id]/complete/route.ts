import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { markDisbursementCompleted } from "@/lib/disbursements";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  try {
    const disbursement = await markDisbursementCompleted(params.id);
    return NextResponse.json({ disbursement });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not mark disbursement completed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
