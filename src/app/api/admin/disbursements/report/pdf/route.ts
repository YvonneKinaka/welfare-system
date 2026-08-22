import { NextResponse } from "next/server";
import { getSession, resolveOrganizationId } from "@/lib/auth";
import { generateDisbursementReport } from "@/lib/pdf";

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

  const pdf = await generateDisbursementReport(organizationId);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="disbursement-report.pdf"`,
    },
  });
}
