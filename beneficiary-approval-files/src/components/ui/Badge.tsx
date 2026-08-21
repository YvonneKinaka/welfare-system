const styles: Record<string, string> = {
  ACTIVE: "bg-success-bg text-success-text border-success-border",
  PAID: "bg-success-bg text-success-text border-success-border",
  APPROVED: "bg-success-bg text-success-text border-success-border",
  SUSPENDED: "bg-danger-bg text-danger-text border-danger-border",
  LAPSED: "bg-danger-bg text-danger-text border-danger-border",
  REJECTED: "bg-danger-bg text-danger-text border-danger-border",
  PENDING: "bg-warning-bg text-warning-text border-warning-border",
  PENDING_APPROVAL: "bg-warning-bg text-warning-text border-warning-border",
  OPEN: "bg-warning-bg text-warning-text border-warning-border",
  CLOSED: "bg-success-bg text-success-text border-success-border",
  ARCHIVED: "bg-brand-50 text-body border-line",
  WAIVED: "bg-brand-50 text-body border-line",
};

function label(status: string) {
  return status
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

export default function Badge({ status }: { status: string }) {
  const style = styles[status] ?? "bg-brand-50 text-body border-line";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${style}`}
    >
      {label(status)}
    </span>
  );
}
