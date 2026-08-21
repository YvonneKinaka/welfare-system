import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

const SESSION_COOKIE = "cwms_session";
const SESSION_TTL_HOURS = 12;

function getSecret() {
  const secret = process.env.SESSION_SECRET || "dev-only-insecure-secret-change-me";
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  role: "ADMIN" | "MEMBER";
  id: string;
  name: string;
  adminRole?: "SUPER_ADMIN" | "ORG_ADMIN"; // only set when role === "ADMIN"
  organizationId?: string | null;
  externalToken?: string; // Tamasha JWT bearer token, when admin login was verified via Tamasha
};

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_HOURS}h`)
    .sign(getSecret());

  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_HOURS * 60 * 60,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export function destroySession() {
  cookies().set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;

const PENDING_ADMIN_AUTH_COOKIE = "cwms_pending_admin_auth";

export type PendingAdminAuth = {
  token: string; // Tamasha JWT from /login
  tamashaUserId: number; // needed by Tamasha's /generate-new-otp (resend)
  phoneNumber?: string; // needed by Tamasha's /generate-new-otp (resend)
};

/**
 * Tamasha's /login issues a JWT and (per the organization) also triggers
 * sending the phone OTP, but this app's own OTP-verify screen still needs
 * a moment to collect the code from the admin. Everything needed for the
 * next two steps (confirm OTP, or resend it) is held here in its own
 * short-lived httpOnly cookie in the meantime - never in a URL query
 * param, never readable by client JS, never written to the database.
 */
export function setPendingAdminAuth(data: PendingAdminAuth) {
  cookies().set(PENDING_ADMIN_AUTH_COOKIE, JSON.stringify(data), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60, // matches the OTP expiry window
  });
}

/** Reads the pending auth data without clearing it - safe to call from resend. */
export function getPendingAdminAuth(): PendingAdminAuth | undefined {
  const raw = cookies().get(PENDING_ADMIN_AUTH_COOKIE)?.value;
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as PendingAdminAuth;
  } catch {
    return undefined;
  }
}

/** Call only once the OTP has actually been confirmed. */
export function clearPendingAdminAuth() {
  cookies().set(PENDING_ADMIN_AUTH_COOKIE, "", { path: "/", maxAge: 0 });
}

const PENDING_MEMBER_AUTH_COOKIE = "cwms_pending_member_auth";

export type PendingMemberAuth = {
  token: string; // Tamasha JWT from /login (guard: welfare)
  tamashaUserId: number; // needed by Tamasha's /generate-new-otp (resend)
  phoneNumber?: string; // needed by Tamasha's /generate-new-otp (resend)
};

/**
 * Member equivalent of setPendingAdminAuth above - deliberately a
 * separate cookie so admin and member pending-login state can never
 * collide or be mixed up, even if both flows are mid-progress in the
 * same browser.
 */
export function setPendingMemberAuth(data: PendingMemberAuth) {
  cookies().set(PENDING_MEMBER_AUTH_COOKIE, JSON.stringify(data), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });
}

export function getPendingMemberAuth(): PendingMemberAuth | undefined {
  const raw = cookies().get(PENDING_MEMBER_AUTH_COOKIE)?.value;
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as PendingMemberAuth;
  } catch {
    return undefined;
  }
}

export function clearPendingMemberAuth() {
  cookies().set(PENDING_MEMBER_AUTH_COOKIE, "", { path: "/", maxAge: 0 });
}

/**
 * The JWT session cookie can be stale (e.g. issued before organizationId
 * was added to the session payload, or simply outdated after 12h). Rather
 * than trust that claim blindly, admin routes that need the organization
 * id should call this instead of reading session.organizationId directly -
 * it falls back to a fresh DB lookup by admin id so a stale cookie can't
 * strand a route.
 */
export async function resolveOrganizationId(session: SessionPayload): Promise<string | null> {
  if (session.organizationId) return session.organizationId;
  const admin = await prisma.admin.findUnique({ where: { id: session.id }, select: { organizationId: true } });
  return admin?.organizationId ?? null;
}
