import { prisma } from "@/lib/db";
import type { NotificationChannel, RecipientType } from "@/lib/enums";

/**
 * NOTIFICATION LAYER
 * ------------------
 * This MVP does not integrate a real SMS or Email provider. Every
 * notification (OTP codes, case-opened alerts, deadline reminders,
 * suspension notices) is recorded in the `Notification` table and
 * "delivered" via the console.
 *
 * To wire up a real provider later (e.g. Africa's Talking for SMS,
 * or Resend/SendGrid for Email):
 *   1. Implement the NotificationProvider interface below.
 *   2. Swap `activeProvider` at the bottom of this file.
 * No calling code anywhere else in the app needs to change.
 */

export interface NotificationPayload {
  recipientType: RecipientType;
  recipientId: string;
  channel: NotificationChannel;
  type: string; // "OTP" | "CASE_OPENED" | "DEADLINE_REMINDER" | "SUSPENSION" | "REACTIVATION"
  to: string; // email address or phone number
  subject?: string;
  message: string;
}

export interface NotificationProvider {
  send(payload: NotificationPayload): Promise<{ success: boolean }>;
}

class ConsoleNotificationProvider implements NotificationProvider {
  async send(payload: NotificationPayload): Promise<{ success: boolean }> {
    // Dev-mode "delivery": print to the server console so the OTP/alert
    // is visible while testing locally without real SMS/Email credentials.
    // eslint-disable-next-line no-console
    console.log(
      `\n📣 [${payload.channel}] to ${payload.to} — ${payload.type}\n   ${payload.subject ?? ""}\n   ${payload.message}\n`
    );
    return { success: true };
  }
}

const activeProvider: NotificationProvider = new ConsoleNotificationProvider();

export async function dispatchNotification(payload: NotificationPayload) {
  const record = await prisma.notification.create({
    data: {
      recipientType: payload.recipientType,
      recipientId: payload.recipientId,
      channel: payload.channel,
      type: payload.type,
      payload: JSON.stringify({ to: payload.to, subject: payload.subject, message: payload.message }),
      status: "PENDING",
    },
  });

  const result = await activeProvider.send(payload);

  await prisma.notification.update({
    where: { id: record.id },
    data: { status: result.success ? "SENT" : "FAILED", sentAt: result.success ? new Date() : null },
  });

  return result;
}
