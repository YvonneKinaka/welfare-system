"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import AuthSplitLayout from "@/components/AuthSplitLayout";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    const params = new URLSearchParams({ identifier: data.identifier });
    if (data.devCode) params.set("devCode", data.devCode);
    router.push(`/login/admin/verify?${params.toString()}`);
  }

  return (
    <AuthSplitLayout
      leftEyebrow="Administrator"
      leftHeading="Manage welfare with clarity."
      leftSubtitle="Register members, open contribution cases, and generate reports for church leadership."
    >
      <p className="text-sm font-semibold text-brand-600 uppercase tracking-wide mb-1">Admin Login</p>
      <h1 className="font-display text-3xl font-semibold text-ink mb-1">Administrator sign in</h1>
      <p className="text-body mb-6">Use your admin credentials to continue.</p>

      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@church.org"
        />
        <Input
          label="Password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
        {error && <p className="text-sm text-danger-text">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Sending code…" : "Continue"} <ArrowRight size={16} />
        </Button>
      </form>
    </AuthSplitLayout>
  );
}
