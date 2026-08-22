import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { reconcilePaymentSchema } from "@/lib/validation";
import { reconcilePaymentTransaction, getLatestTransactionForTarget } from "@/lib/payments";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  if (!session.externalToken) {
    return NextResponse.json(
      { error: "No Tamasha session token found for this admin. Log out and back in, then retry." },
      { status: 400 }
    );
  }

  const body = await req.json();
  const parsed = reconcilePaymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  let transactionId = parsed.data.transactionId;
  if (!transactionId && parsed.data.targetType && parsed.data.targetId) {
    const transaction = await getLatestTransactionForTarget({
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
    });
    if (!transaction) {
      return NextResponse.json({ error: "No payment link has been sent for this yet." }, { status: 404 });
    }
    transactionId = transaction.id;
  }

  try {
    const transaction = await reconcilePaymentTransaction(transactionId!, session.externalToken);
    return NextResponse.json({ transaction });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not reconcile payment status.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
