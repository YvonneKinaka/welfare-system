import { ReactNode } from "react";
import Card from "./Card";

type Tone = "brand" | "warning" | "success" | "danger" | "plain";

const cardTone: Record<Tone, string> = {
  brand: "bg-brand-50 border-brand-100",
  warning: "bg-warning-bg border-warning-border",
  success: "bg-success-bg border-success-border",
  danger: "bg-danger-bg border-danger-border",
  plain: "bg-white border-line",
};

const iconTone: Record<Tone, string> = {
  brand: "bg-white text-brand-600",
  warning: "bg-white text-warning-text",
  success: "bg-white text-success-text",
  danger: "bg-white text-danger-text",
  plain: "bg-brand-50 text-brand-600",
};

export default function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "plain",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: ReactNode;
  tone?: Tone;
}) {
  return (
    <Card className={`p-5 ${cardTone[tone]}`}>
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-body">{label}</p>
        {icon && (
          <span className={`flex h-9 w-9 items-center justify-center rounded-full ${iconTone[tone]}`}>
            {icon}
          </span>
        )}
      </div>
      <p className="mt-3 font-display text-3xl font-semibold text-ink">{value}</p>
      {hint && <p className="mt-1 text-sm text-body">{hint}</p>}
    </Card>
  );
}
