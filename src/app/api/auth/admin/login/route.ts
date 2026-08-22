import { NextRequest, NextResponse } from "next/server";
import { tamashaLogin } from "@/lib/tamashaClient";
import { setPendingAdminAuth } from "@/lib/auth";
import { adminLoginSchema } from "@/lib/validation";

/**
 * Tamasha is the source of admin identity (password + OTP) - this is the
 * intended architecture. The local Admin table still exists and still
 * gates ContributionCase/Contribution/Disbursement/MemberObligation
 * operations via foreign keys, but which local Admin row a given Tamasha
 * account maps to is resolved in verify/route.ts
 * (resolveLocalAdminForTamasha, src/lib/adminSync.ts) - never invented as
 * a synthetic id here or anywhere else.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = adminLoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { email, password } = parsed.data;

  const result = await tamashaLogin(email, password);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }

  if (result.estateSelectionRequired) {
    return NextResponse.json(
      {
        error:
          "This account has access to multiple estates and must choose one before continuing. This app doesn't support estate selection yet - share the accessible_estates response shape and this can be wired in next.",
      },
      { status: 501 }
    );
  }

  setPendingAdminAuth({
    token: result.token,
    tamashaUserId: result.user.id,
    phoneNumber: result.user.phone_number,
    email: result.user.email,
    firstName: result.user.first_name,
    lastName: result.user.last_name,
  });

  return NextResponse.json({ ok: true, identifier: email, delivered: true });
}
