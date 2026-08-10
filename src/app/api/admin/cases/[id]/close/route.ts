import { NextRequest, NextResponse } from "next/server";
import { closeContributionCase } from "@/lib/contributions";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const closed = await closeContributionCase(params.id);
    return NextResponse.json({ case: closed });
  } catch {
    return NextResponse.json({ error: "Could not close case." }, { status: 400 });
  }
}
