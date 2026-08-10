import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyOtp } from "@/lib/otp";
import { createSession } from "@/lib/auth";
import { otpVerifySchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = otpVerifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { identifier, code } = parsed.data;
  const result = await verifyOtp({ identifier, purpose: "MEMBER_LOGIN", code });
  if (!result.valid) {
    return NextResponse.json({ error: result.reason }, { status: 401 });
  }

  const member = await prisma.member.findFirstOrThrow({
    where: { OR: [{ phone: identifier }, { email: identifier }] },
  });
  await createSession({ role: "MEMBER", id: member.id, name: member.fullName });

  return NextResponse.json({ ok: true });
}
