/**
 * SQLite's Prisma connector doesn't support native `enum` types, so every
 * field that would otherwise be an enum is a plain String column in
 * prisma/schema.prisma. These types/constants are the application-level
 * equivalent - the single source of truth for each fixed value set, used
 * for type safety anywhere the code previously imported an enum type from
 * "@prisma/client".
 */

export const MemberStatus = {
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
} as const;
export type MemberStatus = (typeof MemberStatus)[keyof typeof MemberStatus];

export const BeneficiaryStatus = {
  PENDING_APPROVAL: "PENDING_APPROVAL",
  ACTIVE: "ACTIVE",
  REJECTED: "REJECTED",
  ARCHIVED: "ARCHIVED",
} as const;
export type BeneficiaryStatus = (typeof BeneficiaryStatus)[keyof typeof BeneficiaryStatus];

export const CaseStatus = {
  OPEN: "OPEN",
  CLOSED: "CLOSED",
} as const;
export type CaseStatus = (typeof CaseStatus)[keyof typeof CaseStatus];

export const PaymentStatus = {
  PENDING: "PENDING",
  PAID: "PAID",
  LAPSED: "LAPSED", // deadline passed unpaid - counted against the member once
  WAIVED: "WAIVED",
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const OtpPurpose = {
  ADMIN_LOGIN: "ADMIN_LOGIN",
  MEMBER_LOGIN: "MEMBER_LOGIN",
} as const;
export type OtpPurpose = (typeof OtpPurpose)[keyof typeof OtpPurpose];

export const RecipientType = {
  ADMIN: "ADMIN",
  MEMBER: "MEMBER",
} as const;
export type RecipientType = (typeof RecipientType)[keyof typeof RecipientType];

export const NotificationChannel = {
  EMAIL: "EMAIL",
  SMS: "SMS",
} as const;
export type NotificationChannel = (typeof NotificationChannel)[keyof typeof NotificationChannel];

export const NotificationStatus = {
  PENDING: "PENDING",
  SENT: "SENT",
  FAILED: "FAILED",
} as const;
export type NotificationStatus = (typeof NotificationStatus)[keyof typeof NotificationStatus];
