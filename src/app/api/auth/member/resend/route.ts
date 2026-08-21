import { NextRequest, NextResponse } from "next/server";
import { tamashaResendOtp } from "@/lib/tamashaClient";
import { getPendingMemberAuth } from "@/lib/auth";
import { resendMemberOtpSchema } from "@/lib/validation";

/**
 * Resends the phone OTP via Tamasha's real /generate-new-otp, using the
 * Tamasha user id + phone number stashed at login time. Mirrors
 * src/app/api/auth/admin/resend/route.ts exactly, but reads the separate
 * member pending-auth cookie - the two flows never share state.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = resendMemberOtpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const pending = getPendingMemberAuth();
  if (!pending) {
    return NextResponse.json(
      { error: "Your login attempt expired. Please log in again." },
      { status: 401 }
    );
  }

  const result = await tamashaResendOtp(pending.tamashaUserId, pending.phoneNumber);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, identifier: parsed.data.identifier, delivered: true });
}
