import { NextRequest, NextResponse } from "next/server";
import { tamashaLogin, memberGuardName, tamashaEstateId } from "@/lib/tamashaClient";
import { setPendingMemberAuth } from "@/lib/auth";
import { memberLoginSchema } from "@/lib/validation";

/**
 * Member authentication via Tamasha - completely separate from the admin
 * flow (src/app/api/auth/admin/login/route.ts, untouched). Same overall
 * shape (Tamasha verifies credentials -> Tamasha sends OTP -> local Member
 * lookup happens at verify time for portal access), but its own guard
 * ("welfare"), its own pending-auth cookie, and its own local-lookup rule.
 *
 * Local Member existence is intentionally NOT checked here - it's checked
 * at verify time (see verify/route.ts) and is blocking there, unlike the
 * admin flow. Every member-portal page/API queries by a real Member.id,
 * so a session without one would just crash pages rather than degrade
 * gracefully - this app does not auto-create Member records from Tamasha
 * (out of scope: "do not implement member creation").
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = memberLoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { identifier, password } = parsed.data;

  const result = await tamashaLogin(identifier, password, {
    guard: memberGuardName(),
    estateId: tamashaEstateId(),
  });
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }

  setPendingMemberAuth({
    token: result.token,
    tamashaUserId: result.user.id,
    phoneNumber: result.user.phone_number,
  });

  // No devCode here - Tamasha really did send the OTP. `delivered: true`
  // reflects that, matching how the existing verify page already reads it.
  return NextResponse.json({ ok: true, identifier, delivered: true });
}
