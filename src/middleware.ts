import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "cwms_session";

function getSecret() {
  const secret = process.env.SESSION_SECRET || "dev-only-insecure-secret-change-me";
  return new TextEncoder().encode(secret);
}

async function getSessionInfo(
  req: NextRequest
): Promise<{ role: "ADMIN" | "MEMBER" | null; adminRole: "SUPER_ADMIN" | "ORG_ADMIN" | null }> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return { role: null, adminRole: null };
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      role: (payload as any).role ?? null,
      adminRole: (payload as any).adminRole ?? null,
    };
  } catch {
    return { role: null, adminRole: null };
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const { role, adminRole } = await getSessionInfo(req);

  const isApi = pathname.startsWith("/api/");

  if (pathname.startsWith("/super-admin") || pathname.startsWith("/api/super-admin")) {
    if (role !== "ADMIN" || adminRole !== "SUPER_ADMIN") {
      if (isApi) return NextResponse.json({ error: "Not authenticated as super admin." }, { status: 401 });
      return NextResponse.redirect(new URL("/login/admin", req.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    if (role !== "ADMIN") {
      if (isApi) return NextResponse.json({ error: "Not authenticated as admin." }, { status: 401 });
      return NextResponse.redirect(new URL("/login/admin", req.url));
    }
  }

  if (pathname.startsWith("/member") || pathname.startsWith("/api/member")) {
    if (role !== "MEMBER") {
      if (isApi) return NextResponse.json({ error: "Not authenticated as member." }, { status: 401 });
      return NextResponse.redirect(new URL("/login/member", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/member/:path*",
    "/super-admin/:path*",
    "/api/admin/:path*",
    "/api/member/:path*",
    "/api/super-admin/:path*",
  ],
};
