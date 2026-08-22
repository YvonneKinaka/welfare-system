"use client";

import { useEffect, useState } from "react";
import { Wallet2, ExternalLink, Clock } from "lucide-react";
import Button from "@/components/ui/Button";

type TargetType = "OBLIGATION" | "WELFARE_CONTRIBUTION";

type TransactionState = {
  reference: string;
  status: string;
  tamashaPaymentUrl: string | null;
} | null;

/**
 * Members can no longer self-initiate a Tamasha payment - creating a real
 * payment link requires an admin-level Tamasha token (see the Phase 3
 * write-up). This now just looks up whether an admin has already sent one
 * and, if so, links straight to Tamasha's real hosted checkout page. It
 * never creates a transaction or claims a payment has succeeded itself.
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
  const [loading, setLoading] = useState(true);
  const [transaction, setTransaction] = useState<TransactionState>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/member/payments/initiate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType, targetId }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? "Could not check payment status.");
          return;
        }
        setTransaction(data.transaction);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetType, targetId]);

  if (loading) {
    return <p className={`text-xs text-body ${className}`}>Checking payment status…</p>;
  }

  if (error) {
    return <p className={`text-xs text-danger-text ${className}`}>{error}</p>;
  }

  if (transaction?.tamashaPaymentUrl && transaction.status !== "PAID") {
    return (
      <a href={transaction.tamashaPaymentUrl} target="_blank" rel="noopener noreferrer" className={className}>
        <Button variant="secondary" className="w-full">
          <ExternalLink size={14} /> Pay Now
        </Button>
      </a>
    );
  }

  if (transaction) {
    return (
      <div className={`rounded-xl border border-brand-100 bg-brand-50 px-3 py-2 text-xs text-brand-700 flex items-center gap-1.5 ${className}`}>
        <Clock size={12} /> Waiting for your admin to send a payment link · Status: {transaction.status}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-line bg-white px-3 py-2 text-xs text-body flex items-center gap-1.5 ${className}`}>
      <Wallet2 size={12} /> Your admin will send you a payment link to pay this.
    </div>
  );
}
