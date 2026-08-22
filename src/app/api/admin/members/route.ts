import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createMemberSchema } from "@/lib/validation";
import { generateMembershipNumber } from "@/lib/contributions";
import { getSession } from "@/lib/auth";
import { tamashaCreateWelfareMember } from "@/lib/tamashaClient";

export async function GET() {
  const session = await getSession();
  const members = await prisma.member.findMany({
    where: session?.organizationId ? { organizationId: session.organizationId } : undefined,
    orderBy: { createdAt: "desc" },
    include: { beneficiaries: true, _count: { select: { contributions: true } } },
  });
  return NextResponse.json({ members });
}

/**
 * Member creation + Tamasha mapping.
 *
 * Order (per the integration guide - Church Welfare stays the source of
 * truth for the member record; Tamasha is a companion identity system):
 *   1. Create/save the local Church Welfare member first.
 *   2. If the admin supplied an existing tamashaUserId (e.g. a member
 *      already created/tested directly in Tamasha - see
 *      "DO NOT CREATE THIS MEMBER AGAIN" cases), just link it. No Tamasha
 *      API call is made in that case.
 *   3. Otherwise, call Tamasha POST /welfare/members using the *current
 *      admin's own* Tamasha bearer token (session.externalToken, captured
 *      at admin login - never a separate stored app credential), always
 *      with estate_id = tamashaEstateId() (78) - never the local
 *      membership number/id, which is a different, unrelated identifier.
 *   4. Save the returned tamasha_user_id onto the local member.
 *
 * If step 3 fails (Tamasha unreachable, no admin token on this session,
 * etc.), the local member is still kept - Church Welfare remains usable
 * even when Tamasha is unavailable. The response includes a warning the
 * UI can surface, instead of losing the admin's work.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  const body = await req.json();
  const parsed = createMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { fullName, phone, email, tamashaUserId } = parsed.data;

  const existing = await prisma.member.findFirst({
    where: {
      OR: [{ phone }, ...(email ? [{ email }] : []), ...(tamashaUserId ? [{ tamashaUserId }] : [])],
    },
  });
  if (existing) {
    return NextResponse.json(
      { error: "A member with this phone number, email, or Tamasha user ID already exists." },
      { status: 409 }
    );
  }

  const organizationId = session?.organizationId ?? null;

  let member;
  for (let attempt = 0; attempt < 3; attempt++) {
    const membershipNumber = await generateMembershipNumber(organizationId);
    try {
      member = await prisma.member.create({
        data: {
          fullName,
          phone,
          email: email || null,
          membershipNumber,
          organizationId,
          tamashaUserId: tamashaUserId ?? null,
        },
      });
      break;
    } catch (err) {
      // P2002 = unique constraint violation. Only retry if it's specifically
      // the membership number (a true race with another concurrent create);
      // any other unique violation (phone/email/tamashaUserId) is a real
      // conflict and should surface immediately, not be retried.
      const isMembershipNumberClash =
        err instanceof Error &&
        "code" in err &&
        (err as { code?: string }).code === "P2002" &&
        JSON.stringify((err as { meta?: unknown }).meta ?? "").includes("membershipNumber");
      if (!isMembershipNumberClash || attempt === 2) throw err;
    }
  }
  if (!member) {
    return NextResponse.json({ error: "Could not generate a unique membership number." }, { status: 500 });
  }

  // Case 2: admin explicitly linked an already-existing Tamasha member.
  if (tamashaUserId) {
    return NextResponse.json({ member, tamashaLinked: true }, { status: 201 });
  }

  // Case 3: create a new Tamasha welfare member for this local member.
  if (!session?.externalToken) {
    return NextResponse.json(
      {
        member,
        tamashaLinked: false,
        tamashaWarning:
          "Member saved, but couldn't link to Tamasha: no Tamasha session token was found for this admin. Log out and back in, then edit this member to retry.",
      },
      { status: 201 }
    );
  }

  const [firstName, ...rest] = fullName.trim().split(/\s+/);
  const lastName = rest.join(" ") || firstName;

  const tamashaResult = await tamashaCreateWelfareMember(session.externalToken, {
    firstName,
    lastName,
    email: email || undefined,
    phoneNumber: phone,
  });

  if (!tamashaResult.success) {
    return NextResponse.json(
      { member, tamashaLinked: false, tamashaWarning: `Member saved, but Tamasha linking failed: ${tamashaResult.error}` },
      { status: 201 }
    );
  }

  const linkedMember = await prisma.member.update({
    where: { id: member.id },
    data: { tamashaUserId: tamashaResult.tamashaUserId },
  });

  return NextResponse.json({ member: linkedMember, tamashaLinked: true }, { status: 201 });
}
