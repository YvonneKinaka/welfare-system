import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { tamashaVerifyOtp } from "@/lib/tamashaClient";
import { getPendingAdminAuth, clearPendingAdminAuth, createSession } from "@/lib/auth";
import { otpVerifySchema } from "@/lib/validation";

/**
 * Authentication is fully decided by Tamasha (password + OTP) above this
 * point. The local Admin lookup below is authorization enrichment only -
 * it decides which organization/role this person has *within the welfare
 * system*, not whether they're allowed to log in at all. A Tamasha user
 * with no matching local Admin row still gets a valid session; they just
 * won't have organization-scoped access until a super admin links them.
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

  // Non-blocking: this only enriches the session with welfare-system
  // organization/role context, when a link already exists.
  const admin = await prisma.admin.findUnique({ where: { email: identifier } });

  if (admin?.status === "SUSPENDED") {
    return NextResponse.json(
      { error: "This admin account has been suspended. Contact your super admin." },
      { status: 403 }
    );
  }

  clearPendingAdminAuth();

  if (admin) {
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

  // Authenticated via Tamasha, but not yet linked to a local Admin record.
  // "tamasha-" prefix guarantees this id can never collide with a real
  // local Admin cuid.
  await createSession({
    role: "ADMIN",
    id: `tamasha-${pending.tamashaUserId}`,
    name: identifier,
    externalToken: pending.token,
  });
  return NextResponse.json({ ok: true, adminRole: undefined, unprovisioned: true });
}
