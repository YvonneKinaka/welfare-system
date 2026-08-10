import { prisma } from "@/lib/db";

/**
 * Organization payment configuration + member payment obligations.
 * Entirely separate from the existing welfare ContributionCase/Contribution
 * system in src/lib/contributions.ts, which is untouched and keeps working
 * exactly as before regardless of these settings.
 *
 * Two independent, org-wide settings (never chosen by the member):
 *  - Registration: compulsory, ONE_TIME or ANNUAL.
 *  - Contribution: MONTHLY recurring, or PER_WELFARE_CASE (no recurring
 *    payment - the existing welfare case flow is the only obligation).
 */

const DEFAULT_SETTINGS = {
  registrationMode: "ONE_TIME",
  registrationAmount: 0,
  registrationCurrency: "KES",
  registrationInstructions: null as string | null,
  registrationEffectiveDate: null as Date | null,
  renewalMonth: null as number | null,
  registrationGraceDays: 0,
  contributionMode: "PER_WELFARE_CASE",
  monthlyAmount: null as number | null,
  monthlyDueDay: null as number | null,
  monthlyGraceDays: 0,
  reminderDaysBefore: 3,
};

/**
 * Fetches an organization's settings. Registration is compulsory by design,
 * but a brand-new organization may not have configured it yet - in that
 * case we return a safe placeholder (ONE_TIME / amount 0) so the rest of
 * the app doesn't break, until the admin saves real settings.
 */
export async function getOrganizationSettings(organizationId: string) {
  const existing = await prisma.organizationSettings.findUnique({ where: { organizationId } });
  if (existing) return existing;
  return { id: "", organizationId, updatedAt: new Date(), ...DEFAULT_SETTINGS };
}

export async function upsertOrganizationSettings(
  organizationId: string,
  data: {
    registrationMode: string;
    registrationAmount: number;
    registrationCurrency?: string;
    registrationInstructions?: string | null;
    registrationEffectiveDate?: string | null;
    renewalMonth?: number | null;
    registrationGraceDays?: number;
    contributionMode: string;
    monthlyAmount?: number | null;
    monthlyDueDay?: number | null;
    monthlyGraceDays?: number | null;
    reminderDaysBefore?: number | null;
  }
) {
  const payload = {
    registrationMode: data.registrationMode,
    registrationAmount: data.registrationAmount,
    registrationCurrency: data.registrationCurrency ?? "KES",
    registrationInstructions: data.registrationInstructions ?? null,
    registrationEffectiveDate: data.registrationEffectiveDate
      ? new Date(data.registrationEffectiveDate)
      : null,
    renewalMonth: data.registrationMode === "ANNUAL" ? data.renewalMonth ?? null : null,
    registrationGraceDays: data.registrationGraceDays ?? 0,
    contributionMode: data.contributionMode,
    monthlyAmount: data.contributionMode === "MONTHLY" ? data.monthlyAmount ?? null : null,
    monthlyDueDay: data.contributionMode === "MONTHLY" ? data.monthlyDueDay ?? null : null,
    monthlyGraceDays: data.monthlyGraceDays ?? 0,
    reminderDaysBefore: data.reminderDaysBefore ?? 3,
  };

  return prisma.organizationSettings.upsert({
    where: { organizationId },
    update: payload,
    create: { organizationId, ...payload },
  });
}

/** Whether an obligation is overdue "as of now", grace period included. Does not mutate anything. */
export function isObligationOverdue(
  obligation: { status: string; dueDate: Date | string | null },
  graceDays: number
): boolean {
  if (obligation.status === "PAID" || !obligation.dueDate) return false;
  const graceMs = graceDays * 24 * 60 * 60 * 1000;
  return new Date(obligation.dueDate).getTime() + graceMs < Date.now();
}

/** Read-only status that accounts for the grace period, without writing to the database. */
export function effectiveObligationStatus(
  obligation: { status: string; dueDate: Date | string | null },
  graceDays: number
): "PENDING" | "PAID" | "OVERDUE" {
  if (obligation.status === "PAID") return "PAID";
  return isObligationOverdue(obligation, graceDays) ? "OVERDUE" : "PENDING";
}

function currentRenewalPeriodLabel(renewalMonth: number | null): string {
  const now = new Date();
  const month = renewalMonth ?? 1;
  // The renewal "year" is the most recent renewal month that has passed.
  const year = now.getMonth() + 1 >= month ? now.getFullYear() : now.getFullYear() - 1;
  return String(year);
}

function renewalDueDate(renewalMonth: number | null): Date {
  const now = new Date();
  const month = renewalMonth ?? 1;
  const year = now.getMonth() + 1 >= month ? now.getFullYear() : now.getFullYear() - 1;
  return new Date(year, month - 1, 1);
}

/**
 * Ensures the member's registration obligation exists, based on their
 * organization's compulsory registration setting:
 *  - ONE_TIME: a single REGISTRATION row, created once and never duplicated
 *    (even after it's paid).
 *  - ANNUAL: one ANNUAL_RENEWAL row per renewal period; a new one is
 *    created automatically once the current renewal period arrives.
 * Returns null when the member has no organization yet (legacy data).
 */
export async function getOrCreateRegistrationObligation(memberId: string) {
  const member = await prisma.member.findUniqueOrThrow({ where: { id: memberId } });
  if (!member.organizationId) return null;

  const settings = await getOrganizationSettings(member.organizationId);

  if (settings.registrationMode === "ONE_TIME") {
    const existing = await prisma.memberObligation.findFirst({
      where: { memberId, type: "REGISTRATION" },
    });
    if (existing) return existing;

    return prisma.memberObligation.create({
      data: {
        memberId,
        type: "REGISTRATION",
        periodLabel: null,
        amount: settings.registrationAmount,
        dueDate: settings.registrationEffectiveDate,
      },
    });
  }

  // ANNUAL
  const periodLabel = currentRenewalPeriodLabel(settings.renewalMonth);
  const existing = await prisma.memberObligation.findFirst({
    where: { memberId, type: "ANNUAL_RENEWAL", periodLabel },
  });
  if (existing) return existing;

  return prisma.memberObligation.create({
    data: {
      memberId,
      type: "ANNUAL_RENEWAL",
      periodLabel,
      amount: settings.registrationAmount,
      dueDate: renewalDueDate(settings.renewalMonth),
    },
  });
}

function currentMonthLabel(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Ensures the current month's MONTHLY_CONTRIBUTION obligation exists, when
 * the member's organization has contributionMode = MONTHLY. Returns null
 * for PER_WELFARE_CASE organizations (the existing welfare-case flow is
 * unaffected either way) and for members without an organization yet.
 */
export async function getOrCreateCurrentMonthlyObligation(memberId: string) {
  const member = await prisma.member.findUniqueOrThrow({ where: { id: memberId } });
  if (!member.organizationId) return null;

  const settings = await getOrganizationSettings(member.organizationId);
  if (settings.contributionMode !== "MONTHLY") return null;

  const periodLabel = currentMonthLabel();
  const existing = await prisma.memberObligation.findFirst({
    where: { memberId, type: "MONTHLY_CONTRIBUTION", periodLabel },
  });
  if (existing) return existing;

  const now = new Date();
  const dueDay = settings.monthlyDueDay ?? 1;
  const dueDate = new Date(now.getFullYear(), now.getMonth(), dueDay);

  return prisma.memberObligation.create({
    data: {
      memberId,
      type: "MONTHLY_CONTRIBUTION",
      periodLabel,
      amount: settings.monthlyAmount ?? 0,
      dueDate,
    },
  });
}

/** Marks any obligation (registration, annual renewal, or monthly) as paid. */
export async function recordObligationPayment(obligationId: string, recordedById: string) {
  return prisma.memberObligation.update({
    where: { id: obligationId },
    data: { status: "PAID", paidAt: new Date(), recordedById },
  });
}
