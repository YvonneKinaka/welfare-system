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

const PENDING_EXTERNAL_TOKEN_COOKIE = "cwms_pending_ext_token";

/**
 * Tamasha's JWT is issued at the /login step but only needed once the
 * admin's own OTP step completes (that's when the real session cookie is
 * created). It's held here in its own short-lived httpOnly cookie in the
 * meantime - never in a URL query param, never readable by client JS,
 * never written to the database.
 */
export function setPendingExternalToken(token: string) {
  cookies().set(PENDING_EXTERNAL_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60, // matches the OTP expiry window
  });
}

export function consumePendingExternalToken(): string | undefined {
  const token = cookies().get(PENDING_EXTERNAL_TOKEN_COOKIE)?.value;
  cookies().set(PENDING_EXTERNAL_TOKEN_COOKIE, "", { path: "/", maxAge: 0 });
  return token;
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
