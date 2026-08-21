"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Home, CheckCircle2, XCircle } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";

type ApprovalData = {
  approval: { status: string; approverEmail: string; comment: string | null };
  disbursement: {
    status: string;
    recipientName: string;
    amount: number;
    paymentMethod: string;
    accountNumber: string;
    comment: string | null;
    minApprovals: number;
    approvedCount: number;
  };
};

export default function DisbursementApprovalPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<ApprovalData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/disbursements/approve/${token}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "This approval link is invalid.");
        setData(d);
      })
      .catch((e) => setLoadError(e.message));
  }, [token]);

  async function submit(decision: "APPROVED" | "REJECTED") {
    setSubmitting(decision);
    setError("");
    const res = await fetch(`/api/disbursements/approve/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, comment }),
    });
    const responseData = await res.json();
    setSubmitting(null);
    if (!res.ok) {
      setError(responseData.error ?? "Could not record your decision.");
      return;
    }
    setResult(decision);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-paper">
      <div className="w-full max-w-lg">
        <div className="flex items-center gap-2.5 justify-center mb-6">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <Home size={18} />
          </span>
          <p className="font-display text-lg font-semibold text-ink">Church Welfare</p>
        </div>

        <Card>
          {loadError && <p className="text-danger-text">{loadError}</p>}

          {!loadError && !data && <p className="text-body">Loading…</p>}

          {data && !result && data.approval.status !== "PENDING" && (
            <p className="text-body">You already responded to this request.</p>
          )}

          {data && !result && data.disbursement.status !== "PENDING" && data.approval.status === "PENDING" && (
            <p className="text-body">
              This disbursement was already {data.disbursement.status.toLowerCase()} by another approver.
            </p>
          )}

          {data && !result && data.approval.status === "PENDING" && data.disbursement.status === "PENDING" && (
            <>
              <p className="text-sm font-semibold text-brand-600 uppercase tracking-wide mb-1">
                Disbursement Approval
              </p>
              <h1 className="font-display text-2xl font-semibold text-ink mb-4">
                {data.disbursement.recipientName}
              </h1>

              <dl className="space-y-2 text-sm mb-5">
                <div className="flex justify-between">
                  <dt className="text-body">Amount</dt>
                  <dd className="font-mono font-semibold text-ink">KSh {data.disbursement.amount.toLocaleString()}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-body">
                    {data.disbursement.paymentMethod === "BANK" ? "Bank account" : "Mobile money"}
                  </dt>
                  <dd className="font-medium text-ink">{data.disbursement.accountNumber}</dd>
                </div>
                {data.disbursement.comment && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-body shrink-0">Request comment</dt>
                    <dd className="font-medium text-ink text-right">{data.disbursement.comment}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-body">Approvals so far</dt>
                  <dd className="font-medium text-ink">
                    {data.disbursement.approvedCount} / {data.disbursement.minApprovals} required
                  </dd>
                </div>
              </dl>

              <label className="block text-sm font-semibold text-ink mb-1.5">Comment (optional)</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-base text-ink placeholder:text-body/60 focus:border-brand-500 focus:outline-none mb-4"
                placeholder="Add a note for the record (optional)"
              />

              {error && <p className="text-sm text-danger-text mb-3">{error}</p>}

              <div className="flex gap-3">
                <Button
                  variant="success"
                  className="flex-1"
                  disabled={submitting !== null}
                  onClick={() => submit("APPROVED")}
                >
                  <CheckCircle2 size={16} /> {submitting === "APPROVED" ? "Submitting…" : "Approve"}
                </Button>
                <Button
                  variant="danger"
                  className="flex-1"
                  disabled={submitting !== null}
                  onClick={() => submit("REJECTED")}
                >
                  <XCircle size={16} /> {submitting === "REJECTED" ? "Submitting…" : "Reject"}
                </Button>
              </div>
            </>
          )}

          {result && (
            <div className="text-center py-4">
              <Badge status={result} />
              <p className="mt-4 text-ink font-semibold">
                {result === "APPROVED" ? "Thank you - your approval was recorded." : "Your rejection was recorded."}
              </p>
              <p className="mt-1 text-sm text-body">You may close this page now.</p>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
