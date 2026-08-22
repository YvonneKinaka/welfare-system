import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { tamashaListEstateTransactions } from "@/lib/tamashaClient";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  if (!session.externalToken) {
    return NextResponse.json(
      { error: "No Tamasha session token found for this admin. Log out and back in, then retry." },
      { status: 400 }
    );
  }

  const result = await tamashaListEstateTransactions(session.externalToken, { records: 20 });
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ transactions: result.transactions });
}
