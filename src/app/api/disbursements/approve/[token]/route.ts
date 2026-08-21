import { NextRequest, NextResponse } from "next/server";
import { getDisbursementApprovalByToken, decideDisbursementApproval } from "@/lib/disbursements";
import { disbursementApprovalDecisionSchema } from "@/lib/validation";

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const approval = await getDisbursementApprovalByToken(params.token);
  if (!approval) {
    return NextResponse.json({ error: "This approval link is invalid." }, { status: 404 });
  }

  return NextResponse.json({
    approval: {
      status: approval.status,
      approverEmail: approval.approverEmail,
      comment: approval.comment,
    },
    disbursement: {
      status: approval.disbursement.status,
      recipientName: approval.disbursement.recipientName,
      amount: approval.disbursement.amount,
      paymentMethod: approval.disbursement.paymentMethod,
      accountNumber: approval.disbursement.accountNumber,
      comment: approval.disbursement.comment,
      minApprovals: approval.disbursement.minApprovals,
      approvedCount: approval.disbursement.approvals.filter((a) => a.status === "APPROVED").length,
    },
  });
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const body = await req.json();
  const parsed = disbursementApprovalDecisionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const result = await decideDisbursementApproval({
      token: params.token,
      decision: parsed.data.decision,
      comment: parsed.data.comment,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not record your decision.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
