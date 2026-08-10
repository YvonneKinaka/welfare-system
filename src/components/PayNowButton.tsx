"use client";

import { useState } from "react";
import { Wallet2 } from "lucide-react";
import Button from "@/components/ui/Button";

type TargetType = "OBLIGATION" | "WELFARE_CONTRIBUTION";

type TransactionResult = {
  reference: string;
  status: string;
} | null;

/**
 * Calls the real POST /api/member/payments/initiate endpoint and displays
 * whatever it actually returns. No provider is connected yet, so the
 * response is a real PENDING PaymentTransaction row from the database -
 * this never simulates or claims a completed payment.
 */
export default function PayNowButton({
  targetType,
  targetId,
  className = "",
}: {
  targetType: TargetType;
  targetId: string;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [transaction, setTransaction] = useState<TransactionResult>(null);
  const [error, setError] = useState("");

  async function initiate() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/member/payments/initiate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType, targetId }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Could not initiate payment.");
      return;
    }
    setTransaction({ reference: data.transaction.reference, status: data.transaction.status });
  }

  if (transaction) {
    return (
      <div className={`rounded-xl border border-brand-100 bg-brand-50 px-3 py-2 text-xs text-brand-700 ${className}`}>
        Payment initiated · Ref {transaction.reference} · Status: {transaction.status}
      </div>
    );
  }

  return (
    <div className={className}>
      <Button variant="secondary" className="w-full" onClick={initiate} disabled={loading}>
        <Wallet2 size={14} /> {loading ? "Initiating…" : "Pay Now"}
      </Button>
      {error && <p className="mt-1 text-xs text-danger-text">{error}</p>}
    </div>
  );
}
