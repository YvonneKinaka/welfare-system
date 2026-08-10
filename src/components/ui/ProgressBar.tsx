/**
 * Simple terracotta progress bar matching the reference design -
 * used for contribution case collection progress.
 */
export default function ProgressBar({
  paid,
  total,
  amountLabel,
}: {
  paid: number;
  total: number;
  amountLabel?: string;
}) {
  const pct = total > 0 ? Math.round((paid / total) * 100) : 0;

  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between mb-1.5 text-sm">
        <span className="text-body">{pct}% raised</span>
        {amountLabel && <span className="font-semibold text-ink">{amountLabel}</span>}
      </div>
      <div className="h-2 rounded-full bg-brand-50 overflow-hidden">
        <div
          className="h-full rounded-full bg-brand-500 transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
