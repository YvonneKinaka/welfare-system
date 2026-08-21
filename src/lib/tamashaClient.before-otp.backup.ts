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
 * Required env vars (see .env.example):
 *   TAMASHA_API_URL      (defaults to https://api.tamashaportal.co.ke/api/v1/)
 *   TAMASHA_GUARD_NAME    (defaults to "estate")
 */

export interface TamashaUser {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string;
  roles: { id: number; name: string; guard_name: string }[];
}

export type TamashaLoginResult =
  | { success: true; token: string; user: TamashaUser }
  | { success: false; error: string };

function apiUrl(): string {
  const base = process.env.TAMASHA_API_URL || "https://api.tamashaportal.co.ke/api/v1/";
  return base.endsWith("/") ? base : `${base}/`;
}

function guardName(): string {
  return process.env.TAMASHA_GUARD_NAME || "estate";
}

export async function tamashaLogin(email: string, password: string): Promise<TamashaLoginResult> {
  let response: Response;
  try {
    response = await fetch(`${apiUrl()}login`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Guard-Name": guardName(),
      },
      body: JSON.stringify({ email, password }),
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
  };
}
