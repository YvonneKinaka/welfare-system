import { NextRequest, NextResponse } from "next/server";
import { getSession, resolveOrganizationId } from "@/lib/auth";
import { getWalletSummary, recordDeposit } from "@/lib/disbursements";
import { recordDepositSchema } from "@/lib/validation";

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

  const summary = await getWalletSummary(organizationId);
  return NextResponse.json(summary);
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
  const parsed = recordDepositSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const deposit = await recordDeposit({
    organizationId,
    amount: parsed.data.amount,
    note: parsed.data.note,
    recordedById: session.id,
  });
  return NextResponse.json({ deposit }, { status: 201 });
}
