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
        phone_number: member.phoneNumber,
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

  if (!response.ok || body?.success === false || !body?.data?.user_id) {
    return {
      success: false,
      error: body?.message || body?.errors?.[0] || "Could not create the member in Tamasha.",
    };
  }

  return { success: true, tamashaUserId: body.data.user_id };
}
