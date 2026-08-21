import { NextRequest, NextResponse } from "next/server";
import { getSession, resolveOrganizationId } from "@/lib/auth";
import { listDisbursements, createDisbursement } from "@/lib/disbursements";
import { createDisbursementSchema } from "@/lib/validation";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const organizationId = await resolveOrganizationId(session);
  if (!organizationId) {
    return NextResponse.json(
      { error: "No organization is associated with this admin. Try logging out and back in." },
      { status: 400 }
    );
  }

  const disbursements = await listDisbursements(organizationId);
  return NextResponse.json({ disbursements });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const organizationId = await resolveOrganizationId(session);
  if (!organizationId) {
    return NextResponse.json(
      { error: "No organization is associated with this admin. Try logging out and back in." },
      { status: 400 }
    );
  }

  const body = await req.json();
  const parsed = createDisbursementSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const disbursement = await createDisbursement({
      organizationId,
      ...parsed.data,
      requestedById: session.id,
    });
    return NextResponse.json({ disbursement }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not submit disbursement.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
