/**
 * Maps a status string to a tinted card background + border class, so
 * paid/pending contributions and pending/approved/rejected/archived
 * beneficiaries render as color-coded cards (not just colored badges).
 */

export function contributionCardTone(status: string): string {
  switch (status) {
    case "PAID":
      return "bg-success-bg border-success-border";
    case "PENDING":
    case "LAPSED":
      return "bg-danger-bg border-danger-border";
    default:
      return "bg-white border-line";
  }
}

export function beneficiaryCardTone(status: string): string {
  switch (status) {
    case "PENDING_APPROVAL":
      return "bg-warning-bg border-warning-border";
    case "ACTIVE":
      return "bg-success-bg border-success-border";
    case "REJECTED":
      return "bg-danger-bg border-danger-border";
    case "ARCHIVED":
      return "bg-gray-100 border-gray-300";
    default:
      return "bg-white border-line";
  }
}
