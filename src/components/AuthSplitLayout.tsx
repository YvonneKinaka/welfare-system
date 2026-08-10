import Link from "next/link";
import { Home, ArrowLeft } from "lucide-react";

export default function AuthSplitLayout({
  leftEyebrow,
  leftHeading,
  leftSubtitle,
  children,
}: {
  leftEyebrow: string;
  leftHeading: string;
  leftSubtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <div className="lg:w-1/2 bg-peach px-8 py-8 flex flex-col justify-between min-h-[280px] lg:min-h-screen">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-brand-600">
            <Home size={18} />
          </span>
          <p className="font-display text-lg font-semibold text-ink">Church Welfare</p>
        </div>
        <div className="max-w-sm">
          <p className="text-sm font-semibold text-brand-600 uppercase tracking-wide mb-3">
            {leftEyebrow}
          </p>
          <h1 className="font-display text-4xl font-semibold text-ink leading-tight mb-4">
            {leftHeading}
          </h1>
          <p className="text-body">{leftSubtitle}</p>
        </div>
        <div />
      </div>

      <div className="lg:w-1/2 flex flex-col px-8 py-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-ink">
          <ArrowLeft size={16} />
          Back to home
        </Link>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>
    </div>
  );
}
