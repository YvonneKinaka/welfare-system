import { NextRequest, NextResponse } from "next/server";
import { paymentCallbackSchema } from "@/lib/validation";
import { handlePaymentCallback } from "@/lib/payments";

/**
 * Intentionally outside /api/member and /api/admin (and therefore outside
 * the session-cookie middleware) - a real payment provider's webhook can't
 * authenticate with our cookies. Once a real provider is connected, verify
 * its request signature/secret here before trusting the payload.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = paymentCallbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const transaction = await handlePaymentCallback(parsed.data);
  if (!transaction) {
    return NextResponse.json({ error: "Unknown payment reference." }, { status: 404 });
  }

  return NextResponse.json({ transaction });
}
