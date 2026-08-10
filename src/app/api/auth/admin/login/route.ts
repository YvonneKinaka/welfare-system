import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { issueOtp } from "@/lib/otp";
import { adminLoginSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = adminLoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { email, password } = parsed.data;
  const admin = await prisma.admin.findUnique({ where: { email } });

  // Same generic error whether the email or password is wrong - avoids
  // leaking which admin emails exist.
  if (!admin || !(await verifyPassword(password, admin.passwordHash))) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  if (admin.status === "SUSPENDED") {
    return NextResponse.json(
      { error: "This admin account has been suspended. Contact your super admin." },
      { status: 403 }
    );
  }

  const { devCode } = await issueOtp({
    identifier: admin.email,
    purpose: "ADMIN_LOGIN",
    recipientType: "ADMIN",
    recipientId: admin.id,
    channel: "EMAIL",
    displayName: admin.fullName,
  });

  return NextResponse.json({ ok: true, identifier: admin.email, devCode });
}
