import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { issueOtp } from "@/lib/otp";
import { memberLoginSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = memberLoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { identifier } = parsed.data;
  const member = await prisma.member.findFirst({
    where: { OR: [{ phone: identifier }, { email: identifier }] },
  });

  if (!member) {
    return NextResponse.json(
      { error: "We couldn't find a member with that phone number or email." },
      { status: 404 }
    );
  }

  if (member.status === "SUSPENDED") {
    return NextResponse.json(
      { error: "Your membership is currently suspended. Please contact the church office." },
      { status: 403 }
    );
  }

  const channel = identifier.includes("@") ? "EMAIL" : "SMS";
  const contact = channel === "EMAIL" ? member.email! : member.phone;

  const { devCode } = await issueOtp({
    identifier: contact,
    purpose: "MEMBER_LOGIN",
    recipientType: "MEMBER",
    recipientId: member.id,
    channel,
    displayName: member.fullName,
  });

  return NextResponse.json({ ok: true, identifier: contact, devCode });
}
