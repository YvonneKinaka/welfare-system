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
