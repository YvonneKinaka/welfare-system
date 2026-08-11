/**
 * EMAIL PROVIDER - integration point
 * -----------------------------------
 * This file is the ONLY place that should ever contain email-provider-
 * specific code (e.g. Resend, SendGrid, SES). Business logic never
 * imports this file directly - it goes through src/lib/notifications.ts,
 * which only knows about the generic `EmailProvider` interface below.
 *
 * FOR THE API ENGINEER:
 * Implement `ConfiguredEmailProvider.send()` to call the real email API
 * using the environment variables below. Nothing else in the app needs to
 * change - `notifications.ts` already calls this provider for every email.
 *
 * Required env vars (see .env.example):
 *   EMAIL_API_KEY
 *   EMAIL_FROM_ADDRESS
 */

export interface EmailSendResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

export interface EmailProvider {
  send(opts: { to: string; subject: string; message: string }): Promise<EmailSendResult>;
}

function isEmailConfigured(): boolean {
  return Boolean(process.env.EMAIL_API_KEY && process.env.EMAIL_FROM_ADDRESS);
}

export class ConfiguredEmailProvider implements EmailProvider {
  async send(opts: { to: string; subject: string; message: string }): Promise<EmailSendResult> {
    if (!isEmailConfigured()) {
      return {
        success: false,
        error: "Email provider not configured (missing EMAIL_API_KEY / EMAIL_FROM_ADDRESS).",
      };
    }

    // TODO (API engineer): call the real email API here using
    // process.env.EMAIL_API_KEY / EMAIL_FROM_ADDRESS, then return
    // { success: true, providerMessageId } on a real success, or
    // { success: false, error } on a real failure. Until this is
    // implemented, no email is actually sent - do not fake a success here.
    return {
      success: false,
      error: "Email provider integration not yet implemented.",
    };
  }
}

export const emailProvider: EmailProvider = new ConfiguredEmailProvider();
