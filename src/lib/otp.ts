import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { dispatchNotification } from "@/lib/notifications";
import type { OtpPurpose, RecipientType, NotificationChannel } from "@/lib/enums";

const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

function generateCode(): string {
  const min = 10 ** (OTP_LENGTH - 1);
  const max = 10 ** OTP_LENGTH - 1;
  return Math.floor(min + Math.random() * (max - min)).toString();
}

export async function issueOtp(opts: {
  identifier: string; // email or phone
  purpose: OtpPurpose;
  recipientType: RecipientType;
  recipientId: string;
  channel: NotificationChannel;
  displayName: string;
}) {
  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 8);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await prisma.otpCode.create({
    data: {
      identifier: opts.identifier,
      purpose: opts.purpose,
      codeHash,
      expiresAt,
    },
  });

  await dispatchNotification({
    recipientType: opts.recipientType,
    recipientId: opts.recipientId,
    channel: opts.channel,
    type: "OTP",
    to: opts.identifier,
    subject: "Your Church Welfare login code",
    message: `Hi ${opts.displayName}, your one-time login code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes.`,
  });

  // In development, we return the code so you can test the flow without a
  // real inbox/SMS. This return value is ignored by the caller in production.
  return { devCode: process.env.NODE_ENV !== "production" ? code : undefined, expiresAt };
}

export async function verifyOtp(opts: { identifier: string; purpose: OtpPurpose; code: string }) {
  const record = await prisma.otpCode.findFirst({
    where: { identifier: opts.identifier, purpose: opts.purpose, consumed: false },
    orderBy: { createdAt: "desc" },
  });

  if (!record) return { valid: false, reason: "No active code found. Request a new one." };
  if (record.expiresAt < new Date()) return { valid: false, reason: "Code expired. Request a new one." };
  if (record.attempts >= MAX_ATTEMPTS)
    return { valid: false, reason: "Too many attempts. Request a new one." };

  const matches = await bcrypt.compare(opts.code, record.codeHash);

  if (!matches) {
    await prisma.otpCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    return { valid: false, reason: "Incorrect code." };
  }

  await prisma.otpCode.update({ where: { id: record.id }, data: { consumed: true } });
  return { valid: true as const };
}
