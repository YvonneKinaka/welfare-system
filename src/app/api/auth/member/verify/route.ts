import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { tamashaVerifyOtp } from "@/lib/tamashaClient";
import { getPendingMemberAuth, clearPendingMemberAuth, createSession } from "@/lib/auth";
import { otpVerifySchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = otpVerifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { identifier, code } = parsed.data;

  const pending = getPendingMemberAuth();
  if (!pending) {
    return NextResponse.json(
      { error: "Your login attempt expired. Please log in again." },
      { status: 401 }
    );
  }

  // Reuses the same tamashaVerifyOtp() the admin flow already uses - the
  // endpoint is guard-agnostic, so this is not a second OTP implementation.
  const result = await tamashaVerifyOtp(pending.token, code);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }

  // Unlike admin (where an unlinked login still succeeds), a matching
  // local Member record is required here: every member-portal page/API
  // queries by a real Member.id, so a session without one would break
  // immediately rather than degrade gracefully. Member creation is out of
  // scope for this task, so this blocks with a clear message instead.
  const member = await prisma.member.findFirst({
    where: { OR: [{ phone: identifier }, { email: identifier }] },
  });
  if (!member) {
    return NextResponse.json(
      {
        error:
          "Your Tamasha credentials are valid, but no member record matches this phone/email in the Church Welfare system. Contact the church office.",
      },
      { status: 403 }
    );
  }

  if (member.status === "SUSPENDED") {
    return NextResponse.json(
      { error: "Your membership is currently suspended. Please contact the church office." },
      { status: 403 }
    );
  }

  clearPendingMemberAuth();
  await createSession({
    role: "MEMBER",
    id: member.id,
    name: member.fullName,
    externalToken: pending.token,
  });

  return NextResponse.json({ ok: true });
}
