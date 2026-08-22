/**
 * TAMASHA AUTHENTICATION CLIENT
 * -----------------------------
 * The organization's real backend (Postman collection: "Tamasha Backend
 * APIs") is the source of truth for verifying an admin's email/password.
 * This file is the ONLY place that should ever contain Tamasha-specific
 * request/response shapes - src/app/api/auth/admin/login/route.ts just
 * calls `tamashaLogin()` and trusts its result.
 *
 * Confirmed directly from the Postman collection (Authentication folder,
 * "Login" request + its saved example responses):
 *
 *   POST {TAMASHA_API_URL}login
 *     Headers: Accept: application/json
 *              Guard-Name: <guard>   (e.g. "admin" - see note below)
 *              Content-Type: application/json
 *     Body:    { "email": "...", "password": "..." }
 *     Success: { success: true,  data: { token, token_type: "bearer",
 *                                        id, first_name, last_name, email,
 *                                        roles: [...], ... } }
 *     Failure: { success: false, message: "Wrong credentials provided", ... }
 *
 * No API key or client secret is required to call /login itself - Tamasha
 * authenticates the *end user's* email+password, not the calling app. That
 * means there is nothing secret to store except the per-user JWT returned
 * on success, which the login route keeps only in the existing signed,
 * httpOnly session cookie (see src/lib/auth.ts) - never sent to the
 * browser as readable JS, never written to the database.
 *
 * NOTE ON Guard-Name: confirmed directly from the collection's actual
 * "Login" request configuration (not just its example body comments) -
 * it is set to "estate". Defaults to "estate" here; override via
 * TAMASHA_GUARD_NAME only if the organization says otherwise.
 *
 * MEMBER LOGIN (confirmed from the "Tamasha Welfare - Live" collection,
 * "Member login (welfare guard)" request):
 *
 *   POST {TAMASHA_API_URL}login
 *     Headers: guard-name: welfare
 *              Content-Type: application/json
 *     Body:    { "email": "...", "password": "...", "estate_id": 78 }
 *
 * Same endpoint and response envelope as admin login, just a different
 * guard and an extra estate_id field - handled here via tamashaLogin()'s
 * optional `opts` param so the admin call site (which never passes opts)
 * is completely unaffected.
 *
 * OTP step (confirmed by the organization directly - not present in the
 * exported Postman collection itself, but real and now wired up):
 *
 *   POST {TAMASHA_API_URL}verify-otp
 *     Headers: Authorization: bearer <token from /login>
 *              Content-Type: application/json
 *     Body:    { "otp_token": "1234" }
 *
 *   POST {TAMASHA_API_URL}generate-new-otp   (resend)
 *     Headers: Content-Type: application/json
 *     Body:    { "user_id": 123, "phone_number": "2547XXXXXXXX" }
 *
 * Both are guard-agnostic (same shape regardless of estate/welfare guard),
 * so tamashaVerifyOtp/tamashaResendOtp below are shared by admin and
 * member login - no second OTP implementation.
 *
 * ASSUMPTION FLAGGED: only the request bodies for these two endpoints were
 * given, not their full headers or response shape. verify-otp is called
 * here with the /login token as an Authorization bearer header (the same
 * pattern every other authenticated Tamasha endpoint in the collection
 * uses, and the body alone has no way to identify which user is
 * verifying). generate-new-otp is called without that header, since its
 * body already carries user_id/phone_number as explicit identifiers. If
 * either assumption is wrong, the real API's response/status code will
 * make that obvious immediately (e.g. a 401 from verify-otp despite a
 * correct code).
 *
 * Required env vars (see .env.example):
 *   TAMASHA_API_URL          (defaults to https://api.tamashaportal.co.ke/api/v1/)
 *   TAMASHA_GUARD_NAME       (admin guard, defaults to "estate")
 *   TAMASHA_MEMBER_GUARD_NAME (member guard, defaults to "welfare")
 *   TAMASHA_ESTATE_ID        (defaults to "78" - see .env.example note)
 */

import crypto from "crypto";

export interface TamashaUser {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string;
  roles: { id: number; name: string; guard_name: string }[];
}

export type TamashaLoginResult =
  | {
      success: true;
      token: string;
      user: TamashaUser;
      estateSelectionRequired: boolean;
      accessibleEstates?: unknown[];
    }
  | { success: false; error: string };

function apiUrl(): string {
  const base = process.env.TAMASHA_API_URL || "https://api.tamashaportal.co.ke/api/v1/";
  return base.endsWith("/") ? base : `${base}/`;
}

/**
 * Normalizes a phone number to the +254XXXXXXXXX format before it's sent
 * to Tamasha. The Church Welfare admin form places no format constraint
 * on this field (accepts spaces, dashes, a leading 0, with or without a
 * country code) - Tamasha's account-creation call tolerates that loosely
 * and still succeeds, but the welcome SMS/email dispatch that's supposed
 * to follow does not, and silently doesn't fire. This is what was causing
 * "member created, but no welcome message" - the record's phone_number
 * simply wasn't in a dispatchable format.
 */
function normalizeKenyanPhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.startsWith("254")) return `+${digits}`;
  if (digits.startsWith("0")) return `+254${digits.slice(1)}`;
  return `+254${digits}`;
}

function guardName(): string {
  return process.env.TAMASHA_GUARD_NAME || "estate";
}

export function memberGuardName(): string {
  return process.env.TAMASHA_MEMBER_GUARD_NAME || "welfare";
}

export function tamashaEstateId(): string {
  return process.env.TAMASHA_ESTATE_ID || "78";
}

export async function tamashaLogin(
  email: string,
  password: string,
  opts?: { guard?: string; estateId?: string | number }
): Promise<TamashaLoginResult> {
  const guard = opts?.guard ?? guardName();
  const requestBody: Record<string, unknown> = { email, password };
  if (opts?.estateId !== undefined) {
    requestBody.estate_id = Number(opts.estateId);
  }

  let response: Response;
  try {
    response = await fetch(`${apiUrl()}login`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Guard-Name": guard,
      },
      body: JSON.stringify(requestBody),
    });
  } catch {
    return { success: false, error: "Could not reach the organization's authentication service." };
  }

  let body: any;
  try {
    body = await response.json();
  } catch {
    return { success: false, error: "The organization's authentication service returned an unexpected response." };
  }

  if (!response.ok || !body?.success || !body?.data?.token) {
    return {
      success: false,
      error: body?.message || body?.errors?.[0] || "Invalid email or password.",
    };
  }

  return {
    success: true,
    token: body.data.token,
    user: {
      id: body.data.id,
      first_name: body.data.first_name,
      last_name: body.data.last_name,
      email: body.data.email,
      phone_number: body.data.phone_number,
      roles: body.data.roles ?? [],
    },
    // Defensive: only set if Tamasha's response actually includes one of
    // these fields. Never assumed present - most logins won't have it.
    estateSelectionRequired: Boolean(
      body.data.estate_selection_required ?? body.estate_selection_required ?? false
    ),
    accessibleEstates: body.data.accessible_estates ?? body.data.estates ?? undefined,
  };
}

export type TamashaOtpResult = { success: true } | { success: false; error: string };

/**
 * Confirms the OTP Tamasha sent by SMS after a successful /login. See the
 * module doc comment above for the header/assumption this is built on.
 */
export async function tamashaVerifyOtp(token: string, otpCode: string): Promise<TamashaOtpResult> {
  let response: Response;
  try {
    response = await fetch(`${apiUrl()}verify-otp`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `bearer ${token}`,
      },
      body: JSON.stringify({ otp_token: otpCode }),
    });
  } catch {
    return { success: false, error: "Could not reach the organization's authentication service." };
  }

  let body: any;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok || body?.success === false) {
    return {
      success: false,
      error: body?.message || body?.errors?.[0] || "Incorrect or expired code.",
    };
  }

  return { success: true };
}

/** Asks Tamasha to send a fresh OTP to the given user's phone. */
export async function tamashaResendOtp(userId: number, phoneNumber?: string): Promise<TamashaOtpResult> {
  if (!phoneNumber) {
    return { success: false, error: "No phone number on file to resend the code to." };
  }

  let response: Response;
  try {
    response = await fetch(`${apiUrl()}generate-new-otp`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_id: userId, phone_number: phoneNumber }),
    });
  } catch {
    return { success: false, error: "Could not reach the organization's authentication service." };
  }

  let body: any;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok || body?.success === false) {
    return {
      success: false,
      error: body?.message || body?.errors?.[0] || "Could not resend the code.",
    };
  }

  return { success: true };
}

/**
 * MEMBER CREATION (POST /welfare/members)
 * ----------------------------------------
 * Confirmed from TAMASHA_WELFARE_IMPLEMENTATION.md + the "Tamasha Church
 * Welfare - Live" collection ("Create welfare member" request):
 *
 *   POST {TAMASHA_API_URL}welfare/members
 *     Headers: Authorization: Bearer <Welfare admin's Tamasha token>
 *              Content-Type: application/json
 *     Body:    { estate_id, first_name, last_name, email, phone_number,
 *                password, password_confirmation }
 *     Success: { success: true, data: { user_id, estate_id, email, ... } }
 *
 * One call creates the Tamasha user, assigns the Welfare Member role, and
 * links them to the estate - no separate role-assignment call is needed.
 * Requires the *calling admin's own* Tamasha bearer token (their session's
 * externalToken from login), not a separate app-level API key.
 *
 * estate_id always comes from tamashaEstateId() (see above) - the same
 * value already used for member login, confirmed as 78. This is NOT the
 * same thing as a local Church Welfare "unit"/member id (e.g. 840) - do
 * not substitute one for the other.
 */
export type TamashaCreateMemberResult =
  | { success: true; tamashaUserId: number }
  | { success: false; error: string };

function generateTemporaryPassword(): string {
  // Never stored locally or shown in the UI - Tamasha owns this member's
  // credentials from here on (and sends its own welcome email/SMS).
  const random = crypto.randomBytes(9).toString("base64").replace(/[+/=]/g, "x");
  return `Cw-${random}-1A`;
}

export async function tamashaCreateWelfareMember(
  adminToken: string,
  member: { firstName: string; lastName: string; email?: string; phoneNumber: string }
): Promise<TamashaCreateMemberResult> {
  const password = generateTemporaryPassword();

  let response: Response;
  try {
    response = await fetch(`${apiUrl()}welfare/members`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        estate_id: Number(tamashaEstateId()),
        first_name: member.firstName,
        last_name: member.lastName,
        email: member.email,
        phone_number: normalizeKenyanPhone(member.phoneNumber),
        password,
        password_confirmation: password,
      }),
    });
  } catch {
    return { success: false, error: "Could not reach the organization's Tamasha service." };
  }

  let body: any;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok || body?.success === false || !body?.data?.id) {
    // Laravel-style validation responses put the generic wrapper text in
    // `message` and the actual field-level detail in `errors` (an object
    // of field -> message array). We were only ever showing the generic
    // wrapper - this surfaces the real detail instead, so a failure like
    // "phone_number: The phone number format is invalid." is visible
    // instead of just "Please fix all the errors before proceeding."
    let detail: string | undefined;
    if (body?.errors && typeof body.errors === "object") {
      detail = Object.entries(body.errors)
        .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(", ") : messages}`)
        .join(" | ");
    }

    console.error("[Tamasha] POST welfare/members failed:", JSON.stringify(body));

    return {
      success: false,
      error: detail || body?.message || "Could not create the member in Tamasha.",
    };
  }

  return { success: true, tamashaUserId: body.data.id };
}

/**
 * PAYMENT LINKS + RECONCILIATION (Phase 3)
 * ------------------------------------------
 * Confirmed from TAMASHA_WELFARE_IMPLEMENTATION.md + the "Tamasha Church
 * Welfare - Live" collection. All three calls use the *admin's own*
 * Tamasha bearer token (session.externalToken), the same pattern as
 * tamashaCreateWelfareMember above - never a separate stored credential.
 *
 *   POST {TAMASHA_API_URL}welfare/payment-links/notify
 *     Headers: Authorization: Bearer <admin token>, Content-Type: application/json
 *     Body:    { estate_id, user_id, external_reference, amount, currency,
 *                description, expires_in_days }
 *     Success: { success: true, data: { payment_url, email_queued, sms_queued } }
 *
 *   POST {TAMASHA_API_URL}welfare/payments/confirm
 *     Headers: Authorization: Bearer <admin token>, Content-Type: application/json
 *     Body:    { estate_id, checkout_request_id, welfare_reference }
 *     Success: { success: true, data: { status, provider_transaction_id } }
 *     `status` is the ONLY thing allowed to mark a payment PAID - never the
 *     success of the notify call above.
 *
 *   GET {TAMASHA_API_URL}estate-sasapay-transactions/?estate_id=&records=&status=&from_date=&to_date=&s=
 *     Headers: Authorization: Bearer <admin token>, guard-name: estate
 *     Used for manual reconciliation/review, not automatic status changes.
 */

export type TamashaPaymentLinkResult =
  | { success: true; paymentUrl?: string; emailQueued?: boolean; smsQueued?: boolean }
  | { success: false; error: string };

export async function tamashaCreatePaymentLink(
  adminToken: string,
  opts: {
    tamashaUserId: number;
    externalReference: string;
    amount: number;
    currency?: string;
    description?: string;
    expiresInDays?: number;
  }
): Promise<TamashaPaymentLinkResult> {
  let response: Response;
  try {
    response = await fetch(`${apiUrl()}welfare/payment-links/notify`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        estate_id: Number(tamashaEstateId()),
        user_id: opts.tamashaUserId,
        external_reference: opts.externalReference,
        amount: opts.amount,
        currency: opts.currency ?? "KES",
        description: opts.description ?? "Church Welfare contribution",
        expires_in_days: opts.expiresInDays ?? 30,
      }),
    });
  } catch {
    return { success: false, error: "Could not reach the organization's Tamasha service." };
  }

  let body: any;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok || body?.success === false) {
    return { success: false, error: body?.message || body?.errors?.[0] || "Could not create the payment link." };
  }

  return {
    success: true,
    paymentUrl: body?.data?.payment_url,
    emailQueued: body?.data?.email_queued,
    smsQueued: body?.data?.sms_queued,
  };
}

export type TamashaConfirmResult =
  | { success: true; status: "PENDING" | "PROCESSING" | "PAID" | "FAILED"; providerTransactionId?: string }
  | { success: false; error: string };

/**
 * The ONLY function in this app allowed to report a real PAID/FAILED
 * outcome for a Tamasha payment. See src/lib/payments.ts -
 * reconcilePaymentTransaction() is the only caller.
 */
export async function tamashaConfirmPayment(
  adminToken: string,
  opts: { checkoutRequestId?: string; welfareReference: string }
): Promise<TamashaConfirmResult> {
  let response: Response;
  try {
    response = await fetch(`${apiUrl()}welfare/payments/confirm`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        estate_id: Number(tamashaEstateId()),
        checkout_request_id: opts.checkoutRequestId ?? "",
        welfare_reference: opts.welfareReference,
      }),
    });
  } catch {
    return { success: false, error: "Could not reach the organization's Tamasha service." };
  }

  let body: any;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok || body?.success === false || !body?.data?.status) {
    return { success: false, error: body?.message || body?.errors?.[0] || "Could not confirm payment status." };
  }

  return {
    success: true,
    status: body.data.status,
    providerTransactionId: body.data.provider_transaction_id,
  };
}

export type TamashaEstateTransaction = Record<string, unknown>;

/** Manual reconciliation aid - lists estate transactions from Tamasha. Never used to auto-mark anything PAID. */
export async function tamashaListEstateTransactions(
  adminToken: string,
  opts?: { records?: number; status?: string; fromDate?: string; toDate?: string; search?: string }
): Promise<{ success: true; transactions: TamashaEstateTransaction[] } | { success: false; error: string }> {
  const params = new URLSearchParams({
    estate_id: tamashaEstateId(),
    records: String(opts?.records ?? 20),
    status: opts?.status ?? "",
    from_date: opts?.fromDate ?? "",
    to_date: opts?.toDate ?? "",
    s: opts?.search ?? "",
  });

  let response: Response;
  try {
    response = await fetch(`${apiUrl()}estate-sasapay-transactions/?${params.toString()}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${adminToken}`,
        "guard-name": "estate",
      },
    });
  } catch {
    return { success: false, error: "Could not reach the organization's Tamasha service." };
  }

  let body: any;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok || body?.success === false) {
    return { success: false, error: body?.message || "Could not list estate transactions." };
  }

  return { success: true, transactions: body?.data ?? [] };
}

/**
 * WELFARE ADMIN CREATION (POST /welfare/admins)
 * -----------------------------------------------
 * Solves the bootstrap/chicken-and-egg problem: creating the *first*
 * Tamasha estate admin account, before any admin token exists to log in
 * with. Given directly by the engineer (not found in the earlier Postman
 * collections):
 *
 *   POST {TAMASHA_API_URL}welfare/admins
 *     Body: { estate_id, first_name, last_name, email, phone_number,
 *              password, password_confirmation }
 *
 * ASSUMPTION FLAGGED (no auth requirement was specified for this one):
 * called here WITHOUT an Authorization header by default, since this is
 * specifically for bootstrapping the first admin - there may be no valid
 * admin token available yet. `adminToken` is accepted as an optional
 * param in case testing shows this endpoint actually requires one; if a
 * 401 comes back, that's the signal to pass one.
 */
export type TamashaCreateAdminResult =
  | { success: true; tamashaUserId?: number }
  | { success: false; error: string };

export async function tamashaCreateWelfareAdmin(admin: {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  password: string;
  adminToken?: string;
}): Promise<TamashaCreateAdminResult> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (admin.adminToken) headers.Authorization = `Bearer ${admin.adminToken}`;

  let response: Response;
  try {
    response = await fetch(`${apiUrl()}welfare/admins`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        estate_id: Number(tamashaEstateId()),
        first_name: admin.firstName,
        last_name: admin.lastName,
        email: admin.email,
        phone_number: normalizeKenyanPhone(admin.phoneNumber),
        password: admin.password,
        password_confirmation: admin.password,
      }),
    });
  } catch {
    return { success: false, error: "Could not reach the organization's Tamasha service." };
  }

  let body: any;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok || body?.success === false) {
    return {
      success: false,
      error: body?.message || body?.errors?.[0] || "Could not create the admin in Tamasha.",
    };
  }

  return { success: true, tamashaUserId: body?.data?.user_id };
}
