import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { tamashaLogin } from "@/lib/tamashaClient";
import { adminLoginSchema } from "@/lib/validation";

/**
 * INTEGRATION STATUS - read before changing this file.
 * -----------------------------------------------------
 * Step 1 (this file): email+password verified against the real Tamasha
 * API (Guard-Name: estate) - fully implemented, real endpoint, confirmed
 * from the Postman collection.
 *
 * Step 2 (blocked): Tamasha is reported to send an OTP to the phone number
 * on the account after a successful estate-guard login. No endpoint for
 * triggering or verifying that OTP exists anywhere in the provided
 * Postman collection (335 requests searched, including a full-text search
 * for every OTP/verify/2FA-related keyword - the only 36 "OTP" matches in
 * the whole file are inside the unrelated SasaPay/Pesha payment-gateway
 * folders). Per explicit instruction, this route does NOT fall back to
 * issuing this app's own local OTP in place of Tamasha's - that would
 * silently create a second, fake OTP system pretending to be Tamasha's.
 *
 * So: this route currently stops right after confirming the password is
 * correct, and returns a clear "cannot complete" error instead of
 * proceeding. Once the organization provides the missing OTP endpoint
 * (trigger + verify), wire it in here, using result.token (already
 * returned by tamashaLogin) and setPendingExternalToken() from
 * src/lib/auth.ts to carry it through to session creation exactly as the
 * existing local-OTP flow does today.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = adminLoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { email, password } = parsed.data;

  // Tamasha is the source of truth for the password check (Guard-Name: estate).
  const result = await tamashaLogin(email, password);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }

  const admin = await prisma.admin.findUnique({ where: { email } });
  if (!admin) {
    return NextResponse.json(
      {
        error:
          "Your Tamasha credentials are valid, but this account isn't set up in the welfare system yet. Contact your super admin.",
      },
      { status: 403 }
    );
  }

  if (admin.status === "SUSPENDED") {
    return NextResponse.json(
      { error: "This admin account has been suspended. Contact your super admin." },
      { status: 403 }
    );
  }

  // --- Step 2 blocked here - see comment above. ---
  return NextResponse.json(
    {
      error:
        "Password verified with Tamasha, but the phone-OTP step can't be completed yet: no OTP endpoint for this exists in the Postman collection provided. This needs to be confirmed with the organization before login can finish.",
    },
    { status: 501 }
  );
}
