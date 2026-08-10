import { NextRequest, NextResponse } from "next/server";
import { getCaseProgress } from "@/lib/contributions";
import { getSession } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  try {
    const progress = await getCaseProgress(params.id);
    if (
      session?.organizationId &&
      progress.case.affectedMember.organizationId &&
      progress.case.affectedMember.organizationId !== session.organizationId
    ) {
      return NextResponse.json({ error: "Case not found." }, { status: 404 });
    }
    return NextResponse.json(progress);
  } catch {
    return NextResponse.json({ error: "Case not found." }, { status: 404 });
  }
}
