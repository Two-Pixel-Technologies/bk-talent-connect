import { z } from 'zod';
import { LIMITS, countWords } from '../limits.js';
import { WORK_TYPES, EDUCATION_REQUIREMENTS } from '../enums.js';
import { mobileSchema } from './auth.js';
import { webUrlSchema } from './url.js';

/**
 * Job posting schemas, plus the D3 policy shared by client and server:
 * which edits to a live job force it back through review.
 */

export const updateEmployerProfileSchema = z.object({
  companyName: z
    .string()
    .trim()
    .min(LIMITS.employer.companyName.min)
    .max(LIMITS.employer.companyName.max)
    .optional(),
  sectorSlug: z.string().trim().max(80).optional(),
  locations: z.array(z.string().trim().min(1).max(80)).max(LIMITS.employer.locations.max).optional(),
  website: webUrlSchema.optional(),
  linkedinUrl: webUrlSchema.optional(),
  hrContactName: z.string().trim().min(2).max(LIMITS.shortText.max).optional(),
  hrContactPhone: mobileSchema.optional(),
  companyIntro: z
    .string()
    .trim()
    .max(LIMITS.employer.companyIntro.max, `Keep this under ${LIMITS.employer.companyIntro.max} characters.`)
    .optional(),
});
export type UpdateEmployerProfileInput = z.infer<typeof updateEmployerProfileSchema>;

/**
 * What a company must supply before BK can verify it.
 *
 * The proposal's employer table marks sector as required and asks for
 * locations and a company introduction "shown to candidates on the company
 * profile page". Registration collected none of it, so accounts arrived in the
 * verification queue with a name and a phone number and nothing to verify.
 */
export const submitEmployerProfileSchema = z.object({
  companyName: z.string().trim().min(LIMITS.employer.companyName.min, 'Enter your company name.'),
  sectorSlug: z.string().min(1, 'Choose your industry sector.'),
  locationCount: z.number().int().min(1, 'Add at least one hiring location.'),
  companyIntro: z
    .string()
    .trim()
    .min(
      LIMITS.employer.companyIntro.min,
      `Write at least ${LIMITS.employer.companyIntro.min} characters — candidates read this.`,
    ),
  hrContactName: z.string().trim().min(2, 'Enter a contact name.'),
  hrContactPhone: z.string().min(1, 'Enter a contact phone number.'),
});

/**
 * Editing one of these on a VERIFIED company sends it back for review.
 *
 * Company name is the important one: it is what a shortlisted candidate is
 * shown, so a verified account being able to silently rename itself to any
 * brand it likes defeats the point of verifying it.
 */
export const MATERIAL_EMPLOYER_FIELDS = [
  'companyName',
  'sectorSlug',
  'companyIntro',
  /*
   * The URL fields are material too.
   *
   * Both are shown to a shortlisted candidate on the company page, and both
   * can carry a direct contact route — `https://wa.me/91…` is a valid URL. The
   * whole managed model is sold on employers never contacting candidates
   * directly, and leaving these non-material meant a verified account could
   * put a WhatsApp link in front of candidates with a single PATCH and no
   * review. companyIntro was protected and these two were not, which is the
   * gap an audit walked straight through.
   */
  'website',
  'linkedinUrl',
] as const;

export function isMaterialEmployerField(field: string): boolean {
  return (MATERIAL_EMPLOYER_FIELDS as readonly string[]).includes(field);
}

export function materialEmployerFieldsIn(changed: readonly string[]): string[] {
  return changed.filter(isMaterialEmployerField);
}

/** Salary band is entered in LPA and stored as whole rupees. */
const lpaSchema = z
  .number()
  .min(0, 'Salary cannot be negative.')
  .max(LIMITS.salary.max / 100_000, 'That looks too high — enter it in lakhs per annum.');

/** Every field optional: a draft job is saved as it is written. */
export const updateJobSchema = z.object({
  title: z.string().trim().min(LIMITS.job.title.min).max(LIMITS.job.title.max).optional(),
  department: z.string().trim().max(LIMITS.job.department.max).optional(),
  numberOfPositions: z
    .number()
    .int()
    .min(LIMITS.job.numberOfPositions.min)
    .max(LIMITS.job.numberOfPositions.max)
    .optional(),
  sectorSlug: z.string().trim().max(80).optional(),
  functionSlug: z.string().trim().max(80).optional(),
  citySlug: z.string().trim().max(80).optional(),
  state: z.string().trim().max(LIMITS.shortText.max).optional(),
  workType: z.enum(WORK_TYPES).optional(),

  requiredSkills: z
    .array(z.string().trim().min(1).max(60))
    .max(LIMITS.job.requiredSkills.max, `Up to ${LIMITS.job.requiredSkills.max} required skills.`)
    .optional(),
  goodToHaveSkills: z
    .array(z.string().trim().min(1).max(60))
    .max(LIMITS.job.goodToHaveSkills.max)
    .optional(),

  minExperience: z.number().min(LIMITS.job.experienceYears.min).max(LIMITS.job.experienceYears.max).optional(),
  maxExperience: z.number().min(LIMITS.job.experienceYears.min).max(LIMITS.job.experienceYears.max).optional(),
  educationRequirement: z.enum(EDUCATION_REQUIREMENTS).optional(),

  description: z
    .string()
    .trim()
    .max(LIMITS.job.descriptionChars.max, 'That description is too long.')
    .optional(),
  targetJoiningDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the date picker.')
    .or(z.literal(''))
    .optional(),

  salaryBandMinLpa: lpaSchema.optional(),
  salaryBandMaxLpa: lpaSchema.optional(),
});
export type UpdateJobInput = z.infer<typeof updateJobSchema>;

/** Checked when the employer submits the posting for review. */
export const submitJobSchema = z
  .object({
    title: z.string().trim().min(LIMITS.job.title.min, 'Enter a job title.'),
    department: z.string().trim().min(2, 'Enter a department.'),
    numberOfPositions: z.number().int().min(1),
    sectorSlug: z.string().min(1, 'Choose a sector.'),
    functionSlug: z.string().min(1, 'Choose a function.'),
    citySlug: z.string().min(1, 'Choose a city.'),
    state: z.string().min(1, 'Choose a state.'),
    workType: z.enum(WORK_TYPES, { required_error: 'Choose a work type.' }),
    requiredSkillCount: z
      .number()
      .int()
      .min(LIMITS.job.requiredSkills.min, `Add at least ${LIMITS.job.requiredSkills.min} required skills.`),
    minExperience: z.number(),
    maxExperience: z.number(),
    educationRequirement: z.enum(EDUCATION_REQUIREMENTS, {
      required_error: 'Choose an education requirement.',
    }),
    /**
     * The word count is a FIELD-level check, not an object-level refine.
     * Zod skips object refinements entirely when the base parse fails, so an
     * object-level version would stay silent on a mostly-empty posting — the
     * employer would fix every other field, resubmit, and only then be told the
     * description is too short. Field-level errors all report together.
     */
    description: z
      .string()
      .trim()
      .refine((value) => countWords(value) >= LIMITS.job.descriptionWords.min, {
        message: `Write at least ${LIMITS.job.descriptionWords.min} words — this is what candidates read.`,
      }),
    salaryBandMinLpa: lpaSchema,
    salaryBandMaxLpa: lpaSchema,
  })
  .refine((v) => v.maxExperience >= v.minExperience, {
    message: 'Maximum experience cannot be below the minimum.',
    path: ['maxExperience'],
  })
  .refine((v) => v.salaryBandMaxLpa >= v.salaryBandMinLpa, {
    message: 'Maximum salary cannot be below the minimum.',
    path: ['salaryBandMaxLpa'],
  });

/**
 * D3: editing one of these on an APPROVED job pulls it out of public listings
 * and back into review. Everything else applies live.
 *
 * The line is drawn at what a candidate decided to apply on. Adding a headcount
 * or moving the joining date does not change the role; rewriting the
 * description or the skill list does — and unreviewed description edits are how
 * the no-direct-contact rule would be bypassed.
 */
export const MATERIAL_JOB_FIELDS = [
  'title',
  'description',
  'requiredSkills',
  'minExperience',
  'maxExperience',
  'sectorSlug',
  'functionSlug',
  'citySlug',
  'state',
  'workType',
  'educationRequirement',
  'salaryBandMinLpa',
  'salaryBandMaxLpa',
  'department',
] as const;

export const NON_MATERIAL_JOB_FIELDS = [
  'numberOfPositions',
  'targetJoiningDate',
  'goodToHaveSkills',
] as const;

export function isMaterialJobField(field: string): boolean {
  return (MATERIAL_JOB_FIELDS as readonly string[]).includes(field);
}

export function materialJobFieldsIn(changed: readonly string[]): string[] {
  return changed.filter(isMaterialJobField);
}

// ---------------------------------------------------------------------------
// Contact-detail detection
//
// The portal's central rule is that employers never reach candidates directly.
// A job description is free text going straight to candidates, so it is the
// obvious way around that rule — "call me on 98765 43210" in the JD defeats the
// whole intermediary model.
//
// This flags rather than blocks: a description can legitimately contain a
// number ("ISO 9001", "10 years"), so an admin decides. Run at submit time and
// surfaced in the review queue.
// ---------------------------------------------------------------------------

export type ContactFinding = { readonly kind: 'email' | 'phone' | 'url'; readonly value: string };

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]{2,}/g;
/** 10-digit Indian mobile, tolerating spaces, dashes and a +91 prefix. */
const PHONE_RE = /(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b/g;
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"]{4,}/gi;

export function findContactDetails(text: string): ContactFinding[] {
  if (!text) return [];
  const findings: ContactFinding[] = [];
  const seen = new Set<string>();

  const collect = (re: RegExp, kind: ContactFinding['kind']) => {
    for (const match of text.matchAll(re)) {
      const value = match[0].trim();
      const key = `${kind}:${value.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push({ kind, value });
    }
  };

  collect(EMAIL_RE, 'email');
  collect(PHONE_RE, 'phone');
  collect(URL_RE, 'url');

  return findings;
}
