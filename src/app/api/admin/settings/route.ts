import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getOrganizationSettings, upsertOrganizationSettings } from "@/lib/organizationBilling";
import { updateOrganizationSettingsSchema } from "@/lib/validation";

/**
 * The JWT session cookie can be stale (e.g. issued before organizationId
 * was added to the session payload, or simply outdated after 12h). Rather
 * than trust that claim blindly, fall back to a fresh DB lookup by admin id
 * so this route keeps working even with an old cookie still in the browser.
 */
async function resolveOrganizationId(session: { id: string; organizationId?: string | null }) {
  if (session.organizationId) return session.organizationId;
  const admin = await prisma.admin.findUnique({ where: { id: session.id }, select: { organizationId: true } });
  return admin?.organizationId ?? null;
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const organizationId = await resolveOrganizationId(session);
  if (!organizationId) {
    return NextResponse.json(
      { error: "No organization is associated with this admin. Try logging out and back in." },
      { status: 400 }
    );
  }

  const settings = await getOrganizationSettings(organizationId);
  return NextResponse.json({ settings });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const organizationId = await resolveOrganizationId(session);
  if (!organizationId) {
    return NextResponse.json(
      { error: "No organization is associated with this admin. Try logging out and back in." },
      { status: 400 }
    );
  }

  const body = await req.json();
  const parsed = updateOrganizationSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const settings = await upsertOrganizationSettings(organizationId, parsed.data);
  return NextResponse.json({ settings });
}
