"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import AuthSplitLayout from "@/components/AuthSplitLayout";

export default function AdminVerifyPage() {
  const router = useRouter();
  const params = useSearchParams();
  const identifier = params.get("identifier") ?? "";
  const devCode = params.get("devCode");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/admin/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, code }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    router.push(data.adminRole === "SUPER_ADMIN" ? "/super-admin/dashboard" : "/admin/dashboard");
  }

  return (
    <AuthSplitLayout
      leftEyebrow="Administrator"
      leftHeading="Manage welfare with clarity."
      leftSubtitle="Register members, open contribution cases, and generate reports for church leadership."
    >
      <p className="text-sm font-semibold text-brand-600 uppercase tracking-wide mb-1">Admin Login</p>
      <h1 className="font-display text-3xl font-semibold text-ink mb-1">Verify your email</h1>
      <p className="text-body mb-6">
        We sent a 6-digit code to <span className="font-semibold text-ink">{identifier}</span>.
      </p>

      {devCode && (
        <div className="mb-6 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700">
          <strong>Development mode:</strong> no real email is sent yet. Your code is{" "}
          <span className="font-mono font-bold">{devCode}</span>.
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Email Verification Code"
          inputMode="numeric"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="6-digit code"
        />
        {error && <p className="text-sm text-danger-text">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Verifying…" : "Verify"}
        </Button>
        <button
          type="button"
          onClick={() => router.back()}
          className="w-full text-center text-sm text-body font-medium"
        >
          Back
        </button>
      </form>
    </AuthSplitLayout>
  );
}
