"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import AuthSplitLayout from "@/components/AuthSplitLayout";

export default function MemberLoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/member/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    const p = new URLSearchParams({ identifier: data.identifier });
    if (data.devCode) p.set("devCode", data.devCode);
    router.push(`/login/member/verify?${p.toString()}`);
  }

  return (
    <AuthSplitLayout
      leftEyebrow="Member"
      leftHeading="Welcome back, family."
      leftSubtitle="Sign in with your phone number or email — no password required."
    >
      <p className="text-sm font-semibold text-brand-600 uppercase tracking-wide mb-1">Member Login</p>
      <h1 className="font-display text-3xl font-semibold text-ink mb-1">Sign in to continue</h1>
      <p className="text-body mb-6">We'll send a one-time code to your phone or email.</p>

      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Phone Number or Email"
          required
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="e.g. 0712 345 678 or you@example.com"
        />
        {error && <p className="text-sm text-danger-text">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Sending code…" : "Continue"} <ArrowRight size={16} />
        </Button>
      </form>
    </AuthSplitLayout>
  );
}
