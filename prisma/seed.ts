import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Welfare@2026", 10);

  const organization = await prisma.organization.upsert({
    where: { id: "seed-org-default" },
    update: {},
    create: { id: "seed-org-default", name: "Grace Chapel Nairobi" },
  });

  const admin = await prisma.admin.upsert({
    where: { email: "admin@church.org" },
    update: { role: "ORG_ADMIN", organizationId: organization.id },
    create: {
      fullName: "Grace Wanjiru",
      email: "admin@church.org",
      passwordHash,
      role: "ORG_ADMIN",
      organizationId: organization.id,
    },
  });

  const superAdminPasswordHash = await bcrypt.hash("SuperAdmin@2026", 10);
  await prisma.admin.upsert({
    where: { email: "superadmin@church.org" },
    update: {},
    create: {
      fullName: "Platform Super Admin",
      email: "superadmin@church.org",
      passwordHash: superAdminPasswordHash,
      role: "SUPER_ADMIN",
      organizationId: null,
    },
  });

  const membersData = [
    { fullName: "John Mwangi", phone: "+254712000001", email: "john.mwangi@example.com" },
    { fullName: "Mary Achieng", phone: "+254712000002", email: "mary.achieng@example.com" },
    { fullName: "Peter Otieno", phone: "+254712000003", email: "peter.otieno@example.com" },
    { fullName: "Ruth Njeri", phone: "+254712000004", email: "ruth.njeri@example.com" },
    { fullName: "Samuel Kiptoo", phone: "+254712000005", email: null },
  ];

  const members = [];
  for (let i = 0; i < membersData.length; i++) {
    const m = membersData[i];
    const member = await prisma.member.upsert({
      where: { phone: m.phone },
      update: { organizationId: organization.id },
      create: {
        fullName: m.fullName,
        phone: m.phone,
        email: m.email,
        membershipNumber: `CWM-${String(i + 1).padStart(4, "0")}`,
        organizationId: organization.id,
      },
    });
    members.push(member);
  }

  const beneficiariesData = [
    { memberId: members[0].id, fullName: "Alice Mwangi", relationship: "Spouse" },
    { memberId: members[0].id, fullName: "David Mwangi", relationship: "Son" },
    { memberId: members[1].id, fullName: "Elizabeth Achieng", relationship: "Mother" },
    { memberId: members[2].id, fullName: "James Otieno", relationship: "Father" },
    { memberId: members[3].id, fullName: "Grace Njeri", relationship: "Daughter" },
  ];

  // `createMany({ skipDuplicates: true })` isn't supported on SQLite, so
  // this checks for an existing row (by memberId + fullName) before
  // creating each one - just as idempotent, works on every provider.
  for (const b of beneficiariesData) {
    const existing = await prisma.beneficiary.findFirst({
      where: { memberId: b.memberId, fullName: b.fullName },
    });
    if (!existing) {
      await prisma.beneficiary.create({ data: b });
    }
  }

  console.log("Seed complete.");
  console.log("Admin login -> email: admin@church.org / password: Welfare@2026");
  console.log("Super Admin login -> email: superadmin@church.org / password: SuperAdmin@2026");
  console.log("Member login (try any) -> phone: +254712000001");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
