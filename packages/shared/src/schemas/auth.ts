import { z } from 'zod';
import { LIMITS } from '../limits.js';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  // A distinct message for "nothing typed" vs "typed something unusable" —
  // without this, an empty field surfaced zod's own default wording ("String
  // must contain at least 3 character(s)"), which is correct but not
  // something a candidate or employer filling in a form should ever see.
  .min(1, 'Enter your email address.')
  .max(LIMITS.email.max)
  .email('Enter a valid email address.');

export const passwordSchema = z
  .string()
  .min(LIMITS.password.min, `Password must be at least ${LIMITS.password.min} characters.`)
  .max(LIMITS.password.max);

/**
 * An Indian mobile number: ten digits starting 6-9, optionally +91-prefixed,
 * with spaces or dashes anywhere.
 *
 * The previous pattern accepted any 10-15 characters drawn from digits, plus,
 * dash and space — so "++++++++++" passed. This is the ONLY channel BK has to
 * reach a candidate (email is Phase 2), so a number that cannot be dialled is
 * as bad as no number.
 */
export const mobileSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ''))
  .refine((v) => /^(?:\+?91)?[6-9]\d{9}$/.test(v), 'Enter a valid 10-digit Indian mobile number.');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerCandidateSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(LIMITS.candidate.fullName.min, 'Enter your full name.')
    .max(LIMITS.candidate.fullName.max),
  email: emailSchema,
  mobile: mobileSchema,
  password: passwordSchema,
  /**
   * Explicit, logged consent. Admins can put a candidate forward to an employer
   * the candidate never applied to, which under the DPDP Act is a processing
   * purpose needing notice — and commercially, being surfaced to one's current
   * employer is a serious incident in narrow industrial sectors.
   */
  consentToShare: z.literal(true, {
    errorMap: () => ({ message: 'You must consent to your profile being shared with employers.' }),
  }),
});
export type RegisterCandidateInput = z.infer<typeof registerCandidateSchema>;

export const registerEmployerSchema = z.object({
  companyName: z
    .string()
    .trim()
    .min(LIMITS.employer.companyName.min, 'Enter your company name.')
    .max(LIMITS.employer.companyName.max),
  hrContactName: z.string().trim().min(2).max(LIMITS.shortText.max),
  email: emailSchema,
  hrContactPhone: mobileSchema,
  password: passwordSchema,
});
export type RegisterEmployerInput = z.infer<typeof registerEmployerSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword: passwordSchema,
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: 'Your new password must be different from the current one.',
    path: ['newPassword'],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
