import { prisma } from "@/lib/db";
import { dispatchNotification } from "@/lib/notifications";

const FIXED_AMOUNT = 300;
const SUSPENSION_THRESHOLD = 3;

/**
 * Generates the next sequential membership number for an organization,
 * e.g. "RGC-000001". Each organization keeps its own sequence
 * (Organization.memberSequence) as a fast-path hint, but that counter is
 * never trusted blindly - every candidate is checked against real Member
 * rows before being returned, and the counter is advanced past any
 * already-taken numbers. This makes generation self-healing if the
 * counter ever falls out of sync with actual data (e.g. after a seed,
 * an import, or a row created outside this function) - the exact
 * scenario that was producing P2002 on Member.membershipNumber.
 *
 * Falls back to a generic "MEM-" prefix with the same collision-checked
 * approach when no organizationId is supplied, for backward compatibility
 * with pre-multi-org data.
 */
export async function generateMembershipNumber(organizationId?: string | null): Promise<string> {
  const MAX_ATTEMPTS = 1000;

  if (!organizationId) {
    let seq = await prisma.member.count({ where: { organizationId: null } });
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      seq += 1;
      const candidate = `MEM-${String(seq).padStart(6, "0")}`;
      const existing = await prisma.member.findUnique({ where: { membershipNumber: candidate } });
      if (!existing) return candidate;
    }
    throw new Error("Could not generate a unique membership number - too many collisions.");
  }

  const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
  let seq = org.memberSequence;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    seq += 1;
    const candidate = `${org.memberIdPrefix}-${String(seq).padStart(6, "0")}`;
    const existing = await prisma.member.findUnique({ where: { membershipNumber: candidate } });
    if (!existing) {
      // Persist the advanced counter so future calls start from here,
      // self-healing any drift permanently rather than re-checking from
      // the same stale starting point every time.
      await prisma.organization.update({ where: { id: organizationId }, data: { memberSequence: seq } });
      return candidate;
    }
  }

  throw new Error("Could not generate a unique membership number - too many collisions.");
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
  const paidMembers = paid.map((x) => ({ ...x.member, contributionId: x.id }));
  const pendingMembers = c.contributions
    .filter((x) => x.status === "PENDING")
    .map((x) => ({ ...x.member, contributionId: x.id }));
  const lapsedMembers = c.contributions
    .filter((x) => x.status === "LAPSED")
    .map((x) => ({ ...x.member, contributionId: x.id }));

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

const DEADLINE_REMINDER_WINDOW_DAYS = 3;

/**
 * Finds PENDING welfare contributions on OPEN cases whose deadline is
 * approaching (within DEADLINE_REMINDER_WINDOW_DAYS, not yet passed) and
 * sends each member a one-time reminder through the existing notification
 * pipeline (dispatchNotification -> existing SMS/email providers).
 *
 * `reminderSentAt` guarantees each contribution is only ever reminded
 * once - safe to call this repeatedly (e.g. once per day) without
 * duplicate reminders. Contributions that are already past their deadline
 * are handled separately by sweepOverdueContributions(), unaffected by
 * this function.
 */
export async function sendUpcomingDeadlineReminders() {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + DEADLINE_REMINDER_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const upcoming = await prisma.contribution.findMany({
    where: {
      status: "PENDING",
      reminderSentAt: null,
      case: {
        status: "OPEN",
        deadline: { gte: now, lte: windowEnd },
      },
    },
    include: { member: true, case: { include: { beneficiary: true } } },
  });

  const results: { contributionId: string; memberId: string }[] = [];

  for (const contribution of upcoming) {
    await dispatchNotification({
      recipientType: "MEMBER",
      recipientId: contribution.memberId,
      channel: contribution.member.email ? "EMAIL" : "SMS",
      type: "DEADLINE_REMINDER",
      to: contribution.member.email ?? contribution.member.phone,
      subject: "Welfare contribution deadline approaching",
      message: `Reminder: your KSh ${contribution.amount} welfare contribution for ${contribution.case.beneficiary.fullName} is due by ${contribution.case.deadline.toDateString()}.`,
    });

    // Marked immediately after dispatching, so a contribution is never
    // reminded twice even if this function is triggered again the same day.
    await prisma.contribution.update({
      where: { id: contribution.id },
      data: { reminderSentAt: new Date() },
    });

    results.push({ contributionId: contribution.id, memberId: contribution.memberId });
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
