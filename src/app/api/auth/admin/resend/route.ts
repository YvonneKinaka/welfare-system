import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { issueOtp } from "@/lib/otp";
import { resendAdminOtpSchema } from "@/lib/validation";

/**
 * Resends the ADMIN_LOGIN OTP for an identifier that already completed the
 * email+password step moments earlier on /login/admin. This deliberately
 * does not re-check the password - the person already proved they know it
 * to reach the verification screen this button lives on. It reuses the
 * exact same issueOtp() logic as the initial login step, not a second OTP
 * system.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = resendAdminOtpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const admin = await prisma.admin.findUnique({ where: { email: parsed.data.identifier } });
  if (!admin || admin.status === "SUSPENDED") {
    return NextResponse.json({ error: "Could not resend the code." }, { status: 400 });
  }

  const { devCode, delivered, deliveryError } = await issueOtp({
    identifier: admin.email,
    purpose: "ADMIN_LOGIN",
    recipientType: "ADMIN",
    recipientId: admin.id,
    channel: "EMAIL",
    displayName: admin.fullName,
  });

  return NextResponse.json({ ok: true, identifier: admin.email, devCode, delivered, deliveryError });
}
