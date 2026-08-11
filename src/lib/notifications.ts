import { prisma } from "@/lib/db";
import type { NotificationChannel, RecipientType } from "@/lib/enums";
import { smsProvider } from "@/lib/providers/smsProvider";
import { emailProvider } from "@/lib/providers/emailProvider";

/**
 * NOTIFICATION LAYER
 * ------------------
 * The application decides WHEN a notification event happens and WHO it
 * goes to (OTP issuance, payment due/reminder events, welfare case
 * updates, payment success/failure). This file is only responsible for
 * dispatching that decision to the right provider and honestly recording
 * the outcome - it never invents a delivery result.
 *
 * No real SMS/Email provider is connected yet (see src/lib/providers/).
 * Every dispatch is recorded in the `Notification` table for a real audit
 * trail, and its final status honestly reflects what the provider
 * actually returned - PENDING while attempting, then SENT only on a real
 * provider success, or FAILED (with a reason) otherwise. Nothing here
 * pretends a message went out.
 */

export interface NotificationPayload {
  recipientType: RecipientType;
  recipientId: string;
  channel: NotificationChannel;
  type: string; // "OTP" | "CASE_OPENED" | "SUSPENSION" | "REACTIVATION" | "REGISTRATION_DUE" | "ANNUAL_RENEWAL_DUE" | "MONTHLY_CONTRIBUTION_DUE" | "WELFARE_CONTRIBUTION_REMINDER" | "PAYMENT_SUCCESSFUL" | "PAYMENT_FAILED"
  to: string; // email address or phone number
  subject?: string;
  message: string;
  // Optional real payment reference/URL to include with the notification.
  // Only ever populated with a real PaymentTransaction.reference or a real
  // provider checkout URL once one exists - never invented.
  paymentReference?: string;
  paymentUrl?: string;
}

export interface DispatchResult {
  success: boolean;
  error?: string;
}

function buildMessage(payload: NotificationPayload): string {
  const parts = [payload.message];
  if (payload.paymentReference) parts.push(`Reference: ${payload.paymentReference}.`);
  if (payload.paymentUrl) parts.push(`Pay here: ${payload.paymentUrl}`);
  return parts.join(" ");
}

export async function dispatchNotification(payload: NotificationPayload): Promise<DispatchResult> {
  const message = buildMessage(payload);

  const record = await prisma.notification.create({
    data: {
      recipientType: payload.recipientType,
      recipientId: payload.recipientId,
      channel: payload.channel,
      type: payload.type,
      payload: JSON.stringify({ to: payload.to, subject: payload.subject, message }),
      status: "PENDING",
    },
  });

  const result: DispatchResult =
    payload.channel === "EMAIL"
      ? await emailProvider.send({ to: payload.to, subject: payload.subject ?? payload.type, message })
      : await smsProvider.send({ to: payload.to, message });

  await prisma.notification.update({
    where: { id: record.id },
    data: {
      status: result.success ? "SENT" : "FAILED",
      sentAt: result.success ? new Date() : null,
      // Record *why* it failed (e.g. "provider not configured") in the
      // same JSON payload rather than pretending nothing went wrong.
      payload: JSON.stringify({
        to: payload.to,
        subject: payload.subject,
        message,
        ...(result.success ? {} : { error: result.error }),
      }),
    },
  });

  return result;
}

/**
 * Provider-ready OTP delivery functions, as requested for the API
 * engineer handoff. Both build the standard OTP message and dispatch
 * through the same honest path as every other notification - if the
 * provider isn't configured yet, the caller gets `{ success: false,
 * error }` back, never a fake "sent" result.
 */
export async function sendEmailOtp(opts: {
  to: string;
  code: string;
  displayName: string;
  recipientType: RecipientType;
  recipientId: string;
  ttlMinutes: number;
}): Promise<DispatchResult> {
  return dispatchNotification({
    recipientType: opts.recipientType,
    recipientId: opts.recipientId,
    channel: "EMAIL",
    type: "OTP",
    to: opts.to,
    subject: "Your Church Welfare login code",
    message: `Hi ${opts.displayName}, your one-time login code is ${opts.code}. It expires in ${opts.ttlMinutes} minutes.`,
  });
}

export async function sendSmsOtp(opts: {
  to: string;
  code: string;
  displayName: string;
  recipientType: RecipientType;
  recipientId: string;
  ttlMinutes: number;
}): Promise<DispatchResult> {
  return dispatchNotification({
    recipientType: opts.recipientType,
    recipientId: opts.recipientId,
    channel: "SMS",
    type: "OTP",
    to: opts.to,
    message: `Hi ${opts.displayName}, your one-time login code is ${opts.code}. It expires in ${opts.ttlMinutes} minutes.`,
  });
}
