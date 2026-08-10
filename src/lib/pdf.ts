import PDFDocument from "pdfkit";
import { prisma } from "@/lib/db";

const BRAND = "#B4711A";
const INK = "#141110";

export async function generateMemberStatement(memberId: string): Promise<Buffer> {
  const member = await prisma.member.findUniqueOrThrow({
    where: { id: memberId },
    include: {
      contributions: {
        include: { case: { include: { beneficiary: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const doc = new PDFDocument({ margin: 50, size: "A4" });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));

  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  // Header
  doc.fillColor(BRAND).fontSize(20).text("Church Welfare Fund", { align: "left" });
  doc.fillColor(INK).fontSize(11).text("Member Contribution Statement", { align: "left" });
  doc.moveDown(1);

  doc.fontSize(10).fillColor(INK);
  doc.text(`Name: ${member.fullName}`);
  doc.text(`Membership No: ${member.membershipNumber}`);
  doc.text(`Status: ${member.status}`);
  doc.text(`Date Issued: ${new Date().toDateString()}`);
  doc.moveDown(1);

  // Table header
  const tableTop = doc.y;
  const cols = { date: 50, beneficiary: 150, amount: 340, status: 420 };
  doc.fontSize(10).fillColor(BRAND);
  doc.text("Date", cols.date, tableTop);
  doc.text("Beneficiary", cols.beneficiary, tableTop);
  doc.text("Amount (KSh)", cols.amount, tableTop);
  doc.text("Status", cols.status, tableTop);
  doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).strokeColor("#F0E2C0").stroke();

  let y = tableTop + 22;
  doc.fillColor(INK);
  for (const c of member.contributions) {
    if (y > 760) {
      doc.addPage();
      y = 50;
    }
    doc.fontSize(9);
    doc.text(new Date(c.createdAt).toLocaleDateString(), cols.date, y);
    doc.text(c.case.beneficiary.fullName, cols.beneficiary, y, { width: 180 });
    doc.text(String(c.amount), cols.amount, y);
    doc.text(c.status, cols.status, y);
    y += 18;
  }

  const totalPaid = member.contributions
    .filter((c) => c.status === "PAID")
    .reduce((sum, c) => sum + c.amount, 0);
  const totalOutstanding = member.contributions
    .filter((c) => c.status === "PENDING" || c.status === "LAPSED")
    .reduce((sum, c) => sum + c.amount, 0);

  y += 10;
  doc.moveTo(50, y).lineTo(545, y).strokeColor("#F0E2C0").stroke();
  y += 12;
  doc.fontSize(10).fillColor(BRAND).text(`Total Contributed: KSh ${totalPaid}`, 50, y);
  doc.fillColor(INK).text(`Total Outstanding: KSh ${totalOutstanding}`, 340, y);

  doc.end();
  return done;
}

export async function generateCaseReport(caseId: string): Promise<Buffer> {
  const c = await prisma.contributionCase.findUniqueOrThrow({
    where: { id: caseId },
    include: {
      beneficiary: true,
      affectedMember: true,
      contributions: { include: { member: true }, orderBy: { member: { fullName: "asc" } } },
    },
  });

  const paid = c.contributions.filter((x) => x.status === "PAID");
  const unpaid = c.contributions.filter((x) => x.status !== "PAID");
  const expected = c.contributions.length * c.amountPerMember;
  const collected = paid.reduce((sum, x) => sum + x.amount, 0);
  const remaining = expected - collected;
  const pct = c.contributions.length > 0 ? Math.round((paid.length / c.contributions.length) * 100) : 0;

  const doc = new PDFDocument({ margin: 50, size: "A4" });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));

  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  doc.fillColor(BRAND).fontSize(20).text("Church Welfare Fund", { align: "left" });
  doc.fillColor(INK).fontSize(11).text("Contribution Case Report", { align: "left" });
  doc.moveDown(1);

  doc.fontSize(10).fillColor(INK);
  doc.text(`Beneficiary: ${c.beneficiary.fullName} (${c.beneficiary.relationship})`);
  doc.text(`Affected Member: ${c.affectedMember.fullName} (${c.affectedMember.membershipNumber})`);
  doc.text(`Case Status: ${c.status}`);
  doc.text(`Deadline: ${new Date(c.deadline).toDateString()}`);
  doc.text(`Date Issued: ${new Date().toDateString()}`);
  doc.moveDown(1);

  doc.fontSize(11).fillColor(BRAND).text("Summary");
  doc.fontSize(10).fillColor(INK);
  doc.text(`Expected: KSh ${expected}`);
  doc.text(`Collected: KSh ${collected}`);
  doc.text(`Remaining: KSh ${remaining}`);
  doc.text(`Collection: ${pct}% (${paid.length}/${c.contributions.length} members)`);
  doc.moveDown(1);

  function renderMemberTable(title: string, rows: typeof c.contributions) {
    doc.fontSize(11).fillColor(BRAND).text(title);
    const tableTop = doc.y + 4;
    doc.fontSize(10).fillColor(BRAND);
    doc.text("Member", 50, tableTop);
    doc.text("Membership No", 250, tableTop);
    doc.text("Amount (KSh)", 420, tableTop);
    doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).strokeColor("#F0E2C0").stroke();

    let y = tableTop + 22;
    doc.fillColor(INK);
    for (const row of rows) {
      if (y > 760) {
        doc.addPage();
        y = 50;
      }
      doc.fontSize(9);
      doc.text(row.member.fullName, 50, y, { width: 190 });
      doc.text(row.member.membershipNumber, 250, y);
      doc.text(String(row.amount), 420, y);
      y += 18;
    }
    doc.y = y + 10;
  }

  renderMemberTable("Members Who Paid", paid);
  doc.moveDown(0.5);
  renderMemberTable("Members Who Did Not Pay", unpaid);

  doc.end();
  return done;
}
