import { z } from "zod";

export const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

export const otpVerifySchema = z.object({
  identifier: z.string().min(1),
  // Tamasha's real otp_token is 4 digits. Inspection found this was still
  // set to 6 (not yet actually changed, despite that being the intent) -
  // fixed here since it's shared by both admin and member verification and
  // would otherwise reject every real Tamasha code before it's even sent.
  code: z.string().length(4, "Code must be 4 digits"),
});

export const memberLoginSchema = z.object({
  identifier: z.string().min(3, "Enter your registered phone number or email"),
  // Tamasha's /login always requires a password - there is no passwordless
  // option on their side, so this can't stay optional as it was locally.
  password: z.string().min(1, "Password is required"),
});

export const resendMemberOtpSchema = z.object({
  identifier: z.string().min(1),
});

export const createMemberSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  phone: z.string().min(7, "Enter a valid phone number"),
  email: z.string().email().optional().or(z.literal("")),
  // Optional: link an already-existing Tamasha welfare member (e.g. one
  // created/tested directly in Tamasha/Postman) instead of creating a new
  // one. Leave blank to have Church Welfare create it in Tamasha.
  tamashaUserId: z.number().int().positive().optional(),
});

export const updateMemberSchema = z.object({
  fullName: z.string().min(2).optional(),
  phone: z.string().min(7).optional(),
  email: z.string().email().optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
});

export const createBeneficiarySchema = z.object({
  memberId: z.string().min(1),
  fullName: z.string().min(2, "Full name is required"),
  relationship: z.string().min(2, "Relationship is required"),
});

export const updateBeneficiarySchema = z.object({
  fullName: z.string().min(2).optional(),
  relationship: z.string().min(2).optional(),
  status: z.enum(["PENDING_APPROVAL", "ACTIVE", "REJECTED", "ARCHIVED"]).optional(),
});

// Member self-service: submitting a new beneficiary always starts as
// PENDING_APPROVAL (enforced server-side, not accepted from the client).
export const memberCreateBeneficiarySchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  relationship: z.string().min(2, "Relationship is required"),
  phone: z.string().min(7, "Enter a valid phone number"),
});

// Member self-service: editing/resubmitting an existing beneficiary
// (only allowed while it is PENDING_APPROVAL or REJECTED).
export const memberUpdateBeneficiarySchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  relationship: z.string().min(2, "Relationship is required"),
  phone: z.string().min(7, "Enter a valid phone number"),
});

export const createCaseSchema = z.object({
  beneficiaryId: z.string().min(1),
  deadline: z.string().min(1, "Deadline is required"),
  notes: z.string().optional(),
});

export const recordPaymentSchema = z.object({
  memberId: z.string().min(1),
});

// Super Admin: create a new organization.
export const createOrganizationSchema = z.object({
  name: z.string().min(2, "Organization name is required"),
  memberIdPrefix: z
    .string()
    .min(2, "Prefix must be at least 2 characters")
    .max(6, "Prefix must be at most 6 characters")
    .regex(/^[A-Za-z0-9]+$/, "Letters and numbers only")
    .optional(),
});

// Super Admin: create an organization admin (ORG_ADMIN) assigned to an org.
export const createOrgAdminSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  organizationId: z.string().min(1, "Select an organization"),
});

// Super Admin: edit an existing organization admin (name/email/org/status).
export const updateOrgAdminSchema = z.object({
  fullName: z.string().min(2).optional(),
  email: z.string().email().optional(),
  organizationId: z.string().min(1).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
});

// Organization Admin: Membership/Registration + Contribution settings for
// their organization. Registration is compulsory - ONE_TIME or ANNUAL only.
export const updateOrganizationSettingsSchema = z
  .object({
    registrationMode: z.enum(["ONE_TIME", "ANNUAL"]),
    registrationAmount: z.number().int().positive("Amount must be greater than 0"),
    registrationCurrency: z.string().min(1).default("KES"),
    registrationInstructions: z.string().optional().nullable(),
    registrationEffectiveDate: z.string().optional().nullable(),
    renewalMonth: z.number().int().min(1).max(12).optional().nullable(),
    registrationGraceDays: z.number().int().min(0).default(0),

    contributionMode: z.enum(["MONTHLY", "PER_WELFARE_CASE"]),
    monthlyAmount: z.number().int().positive().optional().nullable(),
    monthlyDueDay: z.number().int().min(1).max(31).optional().nullable(),
    monthlyGraceDays: z.number().int().min(0).optional().nullable(),
    reminderDaysBefore: z.number().int().min(0).optional().nullable(),
  })
  .refine((data) => data.registrationMode !== "ANNUAL" || !!data.renewalMonth, {
    message: "Renewal month is required for annual registration",
    path: ["renewalMonth"],
  })
  .refine((data) => data.contributionMode !== "MONTHLY" || !!data.monthlyAmount, {
    message: "Monthly amount is required for monthly contributions",
    path: ["monthlyAmount"],
  })
  .refine((data) => data.contributionMode !== "MONTHLY" || !!data.monthlyDueDay, {
    message: "Monthly due day is required for monthly contributions",
    path: ["monthlyDueDay"],
  });

// Initiate a mock payment transaction against an obligation or welfare contribution.
export const initiatePaymentSchema = z.object({
  targetType: z.enum(["OBLIGATION", "WELFARE_CONTRIBUTION"]),
  targetId: z.string().min(1),
  phone: z.string().min(7, "Enter a valid phone number").optional(),
});

// Payment provider callback/webhook payload (mock shape for now).
export const paymentCallbackSchema = z.object({
  reference: z.string().min(1),
  status: z.enum(["PROCESSING", "PAID", "FAILED"]),
  providerTransactionId: z.string().optional(),
});

// Resend an admin login OTP (re-uses the identifier from the initial
// email+password step, does not require re-entering the password).
export const resendAdminOtpSchema = z.object({
  identifier: z.string().email(),
});

// Admin: record money received into the organization's wallet.
export const recordDepositSchema = z.object({
  amount: z.number().int().positive("Amount must be greater than 0"),
  note: z.string().optional(),
});

// Admin: configure who must approve disbursements, and how many of them.
export const updateDisbursementApprovalSettingsSchema = z
  .object({
    approverEmails: z.array(z.string().email("Enter a valid email")).min(1, "Add at least one approver"),
    minApprovals: z.number().int().min(1, "At least 1 approval is required"),
  })
  .refine((data) => data.minApprovals <= data.approverEmails.length, {
    message: "Minimum approvals can't exceed the number of approvers",
    path: ["minApprovals"],
  });

// Admin: submit a new disbursement for approval.
export const createDisbursementSchema = z.object({
  recipientName: z.string().min(2, "Recipient name is required"),
  amount: z.number().int().positive("Amount must be greater than 0"),
  paymentMethod: z.enum(["BANK", "MOBILE_MONEY"]),
  accountNumber: z.string().min(3, "Enter a valid account or phone number"),
  comment: z.string().optional(),
});

// Approver (no account): approve or reject via their one-time email link.
export const disbursementApprovalDecisionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  comment: z.string().optional(),
});
