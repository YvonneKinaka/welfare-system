import crypto from "crypto";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";

/**
 * Tamasha remains the source of admin identity (password + OTP). This
 * function's only job is making sure that identity always resolves to a
 * REAL row in the local Admin table, so session.id is never a synthetic
 * string like "tamasha-524" - every Admin foreign key
 * (ContributionCase.createdById, Contribution.recordedById,
 * Disbursement.requestedById, MemberObligation.recordedById) depends on
 * this being a real id.
 *
 * Resolution order:
 *   1. Admin.tamashaUserId already links to this Tamasha account -> use it.
 *   2. An Admin row exists with this email but isn't linked yet -> link it
 *      (backfill tamashaUserId) and use it. Self-healing for admins that
 *      already existed locally before this mapping existed.
 *   3. No local Admin exists at all (e.g. Blessing, created directly in
 *      Tamasha via /welfare/admins, never through Church Welfare) ->
 *      create one, synchronizing basic profile fields from Tamasha.
 *      passwordHash is a random, never-used placeholder - Tamasha owns
 *      real authentication for this admin, this field only exists because
 *      the column is required.
 */
export async function resolveLocalAdminForTamasha(opts: {
  tamashaUserId: number;
  email: string;
  fullName: string;
}) {
  const byTamashaId = await prisma.admin.findUnique({ where: { tamashaUserId: opts.tamashaUserId } });
  if (byTamashaId) return byTamashaId;

  const byEmail = await prisma.admin.findUnique({ where: { email: opts.email } });
  if (byEmail) {
    return prisma.admin.update({
      where: { id: byEmail.id },
      data: { tamashaUserId: opts.tamashaUserId },
    });
  }

  // No local Admin exists yet for this Tamasha account - create one.
  // Default organization: this deployment is currently single-organization
  // (Church Welfare / estate 78), so newly-discovered Tamasha admins are
  // attached to whichever organization already exists. Revisit this
  // heuristic if/when true multi-organization admin provisioning is needed.
  const organization = await prisma.organization.findFirst();
  const placeholderPasswordHash = await hashPassword(crypto.randomBytes(24).toString("hex"));

  return prisma.admin.create({
    data: {
      fullName: opts.fullName,
      email: opts.email,
      passwordHash: placeholderPasswordHash,
      role: "ORG_ADMIN",
      organizationId: organization?.id ?? null,
      tamashaUserId: opts.tamashaUserId,
    },
  });
}
