import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { sendEmailOtp, sendSmsOtp } from "@/lib/notifications";
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

  // Real delivery attempt through the provider-ready notification layer.
  // No SMS/Email provider is connected yet, so this honestly comes back
  // as { success: false, error } - it is never treated as a success.
  const sendOpts = {
    to: opts.identifier,
    code,
    displayName: opts.displayName,
    recipientType: opts.recipientType,
    recipientId: opts.recipientId,
    ttlMinutes: OTP_TTL_MINUTES,
  };
  const delivery = opts.channel === "EMAIL" ? await sendEmailOtp(sendOpts) : await sendSmsOtp(sendOpts);

  // In development, we also return the code directly so the flow can be
  // tested without a real inbox/SMS. This is a documented dev-only aid,
  // separate from (and never a substitute for) the real delivery result
  // above - it is never shown as if it were a successful delivery.
  return {
    devCode: process.env.NODE_ENV !== "production" ? code : undefined,
    expiresAt,
    delivered: delivery.success,
    deliveryError: delivery.error,
  };
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
