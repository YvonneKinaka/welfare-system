/**
 * SMS PROVIDER - Hazi SMS integration point
 * ------------------------------------------
 * This file is the ONLY place that should ever contain Hazi-SMS-specific
 * code. Business logic (OTP issuance, payment/obligation reminders, etc.)
 * never imports this file directly - it goes through
 * src/lib/notifications.ts, which only knows about the generic
 * `SmsProvider` interface below.
 *
 * FOR THE API ENGINEER:
 * Implement `HaziSmsProvider.send()` to call the real Hazi SMS API using
 * the environment variables below. Nothing else in the app needs to
 * change - `notifications.ts` already calls this provider for every SMS.
 *
 * Required env vars (see .env.example):
 *   HAZI_SMS_API_KEY
 *   HAZI_SMS_API_URL
 *   HAZI_SMS_SENDER_ID
 */

export interface SmsSendResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

export interface SmsProvider {
  send(opts: { to: string; message: string }): Promise<SmsSendResult>;
}

function isHaziConfigured(): boolean {
  return Boolean(process.env.HAZI_SMS_API_KEY && process.env.HAZI_SMS_API_URL);
}

export class HaziSmsProvider implements SmsProvider {
  async send(opts: { to: string; message: string }): Promise<SmsSendResult> {
    if (!isHaziConfigured()) {
      return {
        success: false,
        error: "SMS provider not configured (missing HAZI_SMS_API_KEY / HAZI_SMS_API_URL).",
      };
    }

    // TODO (API engineer): call the real Hazi SMS API here using
    // process.env.HAZI_SMS_API_KEY / HAZI_SMS_API_URL / HAZI_SMS_SENDER_ID,
    // then return { success: true, providerMessageId } on a real success,
    // or { success: false, error } on a real failure. Until this is
    // implemented, no SMS is actually sent - do not fake a success here.
    return {
      success: false,
      error: "Hazi SMS integration not yet implemented.",
    };
  }
}

export const smsProvider: SmsProvider = new HaziSmsProvider();
