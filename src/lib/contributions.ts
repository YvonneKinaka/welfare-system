import { prisma } from "@/lib/db";
import { dispatchNotification } from "@/lib/notifications";

const FIXED_AMOUNT = 300;
const SUSPENSION_THRESHOLD = 3;

/**
 * Generates the next sequential membership number for an organization,
 * e.g. "RGC-000001". Each organization keeps its own sequence (Organization.
 * memberSequence), incremented atomically. Falls back to a generic "MEM-"
 * prefix with the legacy global-counter behaviour when no organizationId is
 * supplied, for backward compatibility with pre-multi-org data.
 */
export async function generateMembershipNumber(organizationId?: string | null): Promise<string> {
  if (!organizationId) {
    const last = await prisma.member.findFirst({
      orderBy: { createdAt: "desc" },
      select: { membershipNumber: true },
    });
    const lastSeq = last ? parseInt(last.membershipNumber.split("-")[1] ?? "0", 10) : 0;
    const nextSeq = (isNaN(lastSeq) ? 0 : lastSeq) + 1;
    return `MEM-${String(nextSeq).padStart(6, "0")}`;
  }

  const org = await prisma.organization.update({
    where: { id: organizationId },
    data: { memberSequence: { increment: 1 } },
  });
  return `${org.memberIdPrefix}-${String(org.memberSequence).padStart(6, "0")}`;
}

/**
 * Opens a new contribution case for a beneficiary who has passed away.
 * Eligible contributors = every currently ACTIVE member, excluding the
 * affected member themselves (they are the recipient of support, not a
 * contributor to their own case). This is a documented assumption - see
 * README "Assumptions".
 */
export async function openContributionCase(opts: {
  beneficiaryId: string;
  deadline: Date;
  createdById: string;
  notes?: string;
}) {
  const beneficiary = await prisma.beneficiary.findUniqueOrThrow({
    where: { id: opts.beneficiaryId },
    include: { member: true },
  });

  if (beneficiary.status !== "ACTIVE") {
    throw new Error(
      "Only beneficiaries with Active status can be used to open a contribution case."
    );
  }

  const existingOpenCase = await prisma.contributionCase.findFirst({
    where: { beneficiaryId: opts.beneficiaryId, status: "OPEN" },
  });
  if (existingOpenCase) {
    throw new Error("There is already an open contribution case for this beneficiary.");
  }

  const eligibleMembers = await prisma.member.findMany({
    where: {
      status: "ACTIVE",
      id: { not: beneficiary.memberId },
      ...(beneficiary.member.organizationId
        ? { organizationId: beneficiary.member.organizationId }
        : {}),
    },
    select: { id: true },
  });

  const contributionCase = await prisma.contributionCase.create({
    data: {
      beneficiaryId: opts.beneficiaryId,
      affectedMemberId: beneficiary.memberId,
      deadline: opts.deadline,
      amountPerMember: FIXED_AMOUNT,
      createdById: opts.createdById,
      notes: opts.notes,
      contributions: {
        create: eligibleMembers.map((m) => ({
          memberId: m.id,
          amount: FIXED_AMOUNT,
          status: "PENDING" as const,
        })),
      },
    },
    include: { contributions: true, beneficiary: true },
  });

  await dispatchNotification({
    recipientType: "MEMBER",
    recipientId: beneficiary.memberId,
    channel: "EMAIL",
    type: "CASE_OPENED",
    to: beneficiary.member.email ?? beneficiary.member.phone,
    subject: "Welfare contribution case opened",
    message: `A contribution case has been opened for the passing of ${beneficiary.fullName}. Deadline: ${opts.deadline.toDateString()}.`,
  });

  return contributionCase;
}

export async function getCaseProgress(caseId: string) {
  const c = await prisma.contributionCase.findUniqueOrThrow({
    where: { id: caseId },
    include: {
      beneficiary: true,
      affectedMember: true,
      contributions: { include: { member: true } },
    },
  });

  const expected = c.contributions.length * c.amountPerMember;
  const paid = c.contributions.filter((x) => x.status === "PAID");
  const collected = paid.reduce((sum, x) => sum + x.amount, 0);
  const remaining = expected - collected;
  const paidMembers = paid.map((x) => x.member);
  const pendingMembers = c.contributions.filter((x) => x.status === "PENDING").map((x) => x.member);
  const lapsedMembers = c.contributions.filter((x) => x.status === "LAPSED").map((x) => x.member);

  return {
    case: c,
    expected,
    collected,
    remaining,
    paidMembers,
    pendingMembers,
    lapsedMembers,
    isPastDeadline: c.deadline < new Date(),
  };
}

/**
 * Marks a member's contribution for a case as PAID, then checks whether
 * that clears all their outstanding contributions - if so and they were
 * suspended, they are automatically reactivated.
 */
export async function recordPayment(opts: {
  caseId: string;
  memberId: string;
  recordedById: string | null;
  paymentReference?: string;
}) {
  const contribution = await prisma.contribution.update({
    where: { caseId_memberId: { caseId: opts.caseId, memberId: opts.memberId } },
    data: { status: "PAID", paidAt: new Date(), recordedById: opts.recordedById },
    include: { member: true, case: { include: { beneficiary: true } } },
  });

  await dispatchNotification({
    recipientType: "MEMBER",
    recipientId: contribution.memberId,
    channel: contribution.member.email ? "EMAIL" : "SMS",
    type: "PAYMENT_SUCCESSFUL",
    to: contribution.member.email ?? contribution.member.phone,
    subject: "Welfare contribution received",
    message: `Your KSh ${contribution.amount} welfare contribution for ${contribution.case.beneficiary.fullName} has been recorded as paid.`,
    paymentReference: opts.paymentReference,
  });

  await maybeReactivateMember(opts.memberId);
  return contribution;
}

/**
 * Sweeps OPEN cases for contributions past deadline and still PENDING,
 * marks them LAPSED, increments the member's missed count once per
 * lapsed contribution, and suspends the member at the 3-miss threshold.
 * Safe to call repeatedly (idempotent - only PENDING rows are touched).
 */
export async function sweepOverdueContributions() {
  const overdue = await prisma.contribution.findMany({
    where: {
      status: "PENDING",
      case: { status: "OPEN", deadline: { lt: new Date() } },
    },
    include: { member: true, case: { include: { beneficiary: true } } },
  });

  const results: { memberId: string; suspended: boolean }[] = [];

  for (const contribution of overdue) {
    await prisma.contribution.update({
      where: { id: contribution.id },
      data: { status: "LAPSED" },
    });

    await dispatchNotification({
      recipientType: "MEMBER",
      recipientId: contribution.memberId,
      channel: contribution.member.email ? "EMAIL" : "SMS",
      type: "WELFARE_CONTRIBUTION_REMINDER",
      to: contribution.member.email ?? contribution.member.phone,
      subject: "Welfare contribution overdue",
      message: `Your KSh ${contribution.amount} welfare contribution for ${contribution.case.beneficiary.fullName} is now overdue.`,
    });

    const updatedMember = await prisma.member.update({
      where: { id: contribution.memberId },
      data: { missedCount: { increment: 1 } },
    });

    let suspended = false;
    if (updatedMember.missedCount >= SUSPENSION_THRESHOLD && updatedMember.status !== "SUSPENDED") {
      await prisma.member.update({ where: { id: updatedMember.id }, data: { status: "SUSPENDED" } });
      suspended = true;
      await dispatchNotification({
        recipientType: "MEMBER",
        recipientId: updatedMember.id,
        channel: "EMAIL",
        type: "SUSPENSION",
        to: updatedMember.email ?? updatedMember.phone,
        subject: "Your membership has been suspended",
        message: `You have missed ${updatedMember.missedCount} welfare contribution deadlines and have been suspended. Clear outstanding contributions to be reactivated.`,
      });
    }
    results.push({ memberId: updatedMember.id, suspended });
  }

  return results;
}

async function maybeReactivateMember(memberId: string) {
  const member = await prisma.member.findUniqueOrThrow({ where: { id: memberId } });
  if (member.status !== "SUSPENDED") return;

  const outstanding = await prisma.contribution.count({
    where: { memberId, status: { in: ["PENDING", "LAPSED"] } },
  });

  if (outstanding === 0) {
    await prisma.member.update({ where: { id: memberId }, data: { status: "ACTIVE", missedCount: 0 } });
    await dispatchNotification({
      recipientType: "MEMBER",
      recipientId: memberId,
      channel: "EMAIL",
      type: "REACTIVATION",
      to: member.email ?? member.phone,
      subject: "Your membership has been reactivated",
      message: `You have cleared all outstanding contributions and your membership is now Active again.`,
    });
  }
}

export async function closeContributionCase(caseId: string) {
  const c = await prisma.contributionCase.update({
    where: { id: caseId },
    data: { status: "CLOSED", closedAt: new Date() },
    include: { beneficiary: true },
  });
  // Successful claim -> archive the beneficiary so it can't be reused.
  await prisma.beneficiary.update({ where: { id: c.beneficiaryId }, data: { status: "ARCHIVED" } });
  return c;
}

export const FIXED_CONTRIBUTION_AMOUNT = FIXED_AMOUNT;
export const SUSPENSION_MISS_THRESHOLD = SUSPENSION_THRESHOLD;
