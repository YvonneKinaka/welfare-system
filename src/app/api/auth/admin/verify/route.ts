import { NextRequest, NextResponse } from "next/server";
import { tamashaVerifyOtp } from "@/lib/tamashaClient";
import { getPendingAdminAuth, clearPendingAdminAuth, createSession } from "@/lib/auth";
import { resolveLocalAdminForTamasha } from "@/lib/adminSync";
import { otpVerifySchema } from "@/lib/validation";

/**
 * Authentication (password + OTP) is fully decided by Tamasha above this
 * point. session.id is always a real local Admin.id, resolved or
 * auto-created by resolveLocalAdminForTamasha - never a synthetic string
 * like "tamasha-524". This is what fixes the ContributionCase/
 * Contribution/Disbursement/MemberObligation foreign key violations.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = otpVerifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { identifier, code } = parsed.data;

  const pending = getPendingAdminAuth();
  if (!pending) {
    return NextResponse.json(
      { error: "Your login attempt expired. Please log in again." },
      { status: 401 }
    );
  }

  const result = await tamashaVerifyOtp(pending.token, code);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }

  const admin = await resolveLocalAdminForTamasha({
    tamashaUserId: pending.tamashaUserId,
    email: pending.email,
    fullName: `${pending.firstName} ${pending.lastName}`.trim(),
  });

  if (admin.status === "SUSPENDED") {
    return NextResponse.json(
      { error: "This admin account has been suspended. Contact the church office." },
      { status: 403 }
    );
  }

  clearPendingAdminAuth();
  await createSession({
    role: "ADMIN",
    id: admin.id,
    name: admin.fullName,
    adminRole: admin.role as "SUPER_ADMIN" | "ORG_ADMIN",
    organizationId: admin.organizationId,
    externalToken: pending.token,
  });

  return NextResponse.json({ ok: true, adminRole: admin.role });
}
