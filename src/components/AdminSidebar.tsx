"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, LayoutDashboard, Users, Heart, Layers, FileText, LogOut, ClipboardCheck, Settings, Receipt } from "lucide-react";

const links = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/members", label: "Members", icon: Users },
  { href: "/admin/beneficiaries", label: "Beneficiaries", icon: Heart },
  { href: "/admin/beneficiary-approvals", label: "Beneficiary Approvals", icon: ClipboardCheck },
  { href: "/admin/cases", label: "Contribution Cases", icon: Layers },
  { href: "/admin/payments/transactions", label: "Tamasha Transactions", icon: Receipt },
  { href: "/admin/reports", label: "Reports", icon: FileText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login/admin");
  }

  return (
    <aside className="w-64 shrink-0 border-r border-line bg-white/60 min-h-screen flex flex-col px-4 py-6">
      <div className="flex items-center gap-2.5 px-2 mb-8">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <Home size={18} />
        </span>
        <div>
          <p className="font-display text-lg font-semibold leading-tight text-ink">Church Welfare</p>
          <p className="text-xs text-body">Admin Portal</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        {links.map((l) => {
          const active = pathname.startsWith(l.href);
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center gap-3 rounded-full px-4 py-2.5 text-[15px] font-medium transition-colors ${
                active ? "bg-brand-500 text-white" : "text-ink hover:bg-brand-50"
              }`}
            >
              <Icon size={18} />
              {l.label}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={logout}
        className="flex items-center gap-3 rounded-full px-4 py-2.5 text-[15px] font-medium text-danger-text hover:bg-danger-bg transition-colors"
      >
        <LogOut size={18} />
        Log out
      </button>
    </aside>
  );
}
