import { z } from "zod";

export const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

export const otpVerifySchema = z.object({
  identifier: z.string().min(1),
  code: z.string().length(6, "Code must be 6 digits"),
});

export const memberLoginSchema = z.object({
  identifier: z.string().min(3, "Enter your registered phone number or email"),
});

export const createMemberSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  phone: z.string().min(7, "Enter a valid phone number"),
  email: z.string().email().optional().or(z.literal("")),
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
