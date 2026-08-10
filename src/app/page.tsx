import Link from "next/link";
import { Home, Heart, ArrowRight } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-line">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <Home size={18} />
            </span>
            <div>
              <p className="font-display text-lg font-semibold leading-tight text-ink">Church Welfare</p>
              <p className="text-xs text-body">Management System</p>
            </div>
          </div>
          <nav className="flex items-center gap-3">
            <Link
              href="/login/member"
              className="inline-flex items-center rounded-full bg-brand-500 text-white px-5 py-2.5 text-[15px] font-semibold hover:bg-brand-600 transition-colors"
            >
              Member Login
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-2xl text-center py-20">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 text-brand-600 px-4 py-1.5 text-sm font-medium mb-6">
            <Heart size={14} />
            Standing together in times of loss
          </span>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold text-ink leading-tight mb-5">
            Church Welfare
            <br />
            Management System
          </h1>
          <p className="text-body text-lg mb-8 max-w-lg mx-auto">
            A digital platform that helps church members manage bereavement welfare contributions
            transparently and efficiently.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/login/member"
              className="inline-flex items-center gap-2 rounded-full bg-brand-500 text-white px-6 py-3 text-[15px] font-semibold hover:bg-brand-600 transition-colors"
            >
              Member Login <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
