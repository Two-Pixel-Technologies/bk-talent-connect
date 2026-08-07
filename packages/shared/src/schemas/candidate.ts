import { z } from 'zod';
import { webUrlSchema } from './url.js';
import { LIMITS } from '../limits.js';
import { mobileSchema } from './auth.js';
import {
  EDUCATION_LEVELS,
  EMPLOYMENT_PREFERENCES,
  NOTICE_PERIODS,
} from '../enums.js';

/**
 * Candidate profile schemas, plus the two pieces of policy that must be
 * identical on the client and the server:
 *
 *   1. MATERIAL_FIELDS — which edits send an approved profile back for review.
 *   2. COMPLETION_WEIGHTS — what the completion percentage actually means.
 *
 * Plan reference: D2, MEDIUM-17.
 */

const currentYear = new Date().getFullYear();

export const experienceSchema = z
  .object({
    id: z.string().optional(),
    company: z.string().trim().min(2).max(LIMITS.shortText.max),
    title: z.string().trim().min(2).max(LIMITS.shortText.max),
    startYear: z.number().int().min(1960).max(currentYear),
    endYear: z.number().int().min(1960).max(currentYear).nullable().optional(),
    isCurrent: z.boolean().default(false),
    domainTags: z.array(z.string().trim().min(1).max(50)).max(10).default([]),
    keyAchievement: z.string().trim().max(LIMITS.candidate.keyAchievement.max).optional(),
  })
  .refine((v) => v.isCurrent || v.endYear != null, {
    message: 'Give an end year, or mark this as your current role.',
    path: ['endYear'],
  })
  .refine((v) => v.endYear == null || v.endYear >= v.startYear, {
    message: 'End year cannot be before the start year.',
    path: ['endYear'],
  });
export type ExperienceInput = z.infer<typeof experienceSchema>;

/** Salary is entered in LPA and converted to whole rupees before storage. */
const lpaSchema = z
  .number()
  .min(0, 'Salary cannot be negative.')
  .max(LIMITS.salary.max / 100_000, 'That salary looks too high — enter it in lakhs per annum.');

/**
 * Every field is optional here: the wizard saves each step as the candidate
 * goes, and a half-finished profile must be storable. Completeness is enforced
 * by submitProfileSchema at submit time.
 */
export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(LIMITS.candidate.fullName.min).max(LIMITS.candidate.fullName.max).optional(),
  mobile: mobileSchema.optional(),
  citySlug: z.string().trim().max(80).optional(),
  state: z.string().trim().max(LIMITS.shortText.max).optional(),
  openToRelocation: z.boolean().optional(),

  currentJobTitle: z.string().trim().max(LIMITS.shortText.max).optional(),
  currentEmployer: z.string().trim().max(LIMITS.shortText.max).optional(),
  yearsOfExperience: z
    .number()
    .min(LIMITS.candidate.yearsOfExperience.min)
    .max(LIMITS.candidate.yearsOfExperience.max)
    .optional(),
  sectorSlug: z.string().trim().max(80).optional(),
  functionSlug: z.string().trim().max(80).optional(),
  educationLevel: z.enum(EDUCATION_LEVELS).optional(),
  qualification: z.string().trim().max(LIMITS.shortText.max).optional(),
  qualificationYear: z.number().int().min(1960).max(currentYear + 6).optional(),

  careerSummary: z
    .string()
    .trim()
    .max(LIMITS.candidate.careerSummary.max, `Keep this under ${LIMITS.candidate.careerSummary.max} characters.`)
    .optional(),

  noticePeriod: z.enum(NOTICE_PERIODS).optional(),
  employmentPreference: z.enum(EMPLOYMENT_PREFERENCES).optional(),

  currentSalaryLpa: lpaSchema.optional(),
  expectedSalaryMinLpa: lpaSchema.optional(),
  expectedSalaryMaxLpa: lpaSchema.optional(),

  linkedinUrl: webUrlSchema.optional(),

  skills: z
    .array(z.string().trim().min(1).max(60))
    .max(LIMITS.candidate.skills.max, `You can list up to ${LIMITS.candidate.skills.max} skills.`)
    .optional(),

  experiences: z.array(experienceSchema).max(LIMITS.candidate.experienceRows.max).optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/** The complete-profile contract, checked when the candidate hits Submit. */
export const submitProfileSchema = z
  .object({
    fullName: z.string().trim().min(LIMITS.candidate.fullName.min),
    mobile: mobileSchema,
    citySlug: z.string().min(1, 'Choose your city.'),
    state: z.string().min(1, 'Choose your state.'),
    currentJobTitle: z.string().trim().min(2, 'Enter your current job title.'),
    yearsOfExperience: z.number().min(0, 'Enter your years of experience.'),
    sectorSlug: z.string().min(1, 'Choose your sector.'),
    functionSlug: z.string().min(1, 'Choose your function.'),
    educationLevel: z.enum(EDUCATION_LEVELS, { required_error: 'Choose your education level.' }),
    qualification: z.string().trim().min(2, 'Enter your qualification.'),
    qualificationYear: z.number().int(),
    careerSummary: z
      .string()
      .trim()
      .min(
        LIMITS.candidate.careerSummary.min,
        `Write at least ${LIMITS.candidate.careerSummary.min} characters — this is what our team reads first.`,
      ),
    noticePeriod: z.enum(NOTICE_PERIODS, { required_error: 'Choose your notice period.' }),
    employmentPreference: z.enum(EMPLOYMENT_PREFERENCES, {
      required_error: 'Choose your employment preference.',
    }),
    currentSalaryLpa: lpaSchema,
    expectedSalaryMinLpa: lpaSchema,
    expectedSalaryMaxLpa: lpaSchema,
    skillCount: z.number().int().min(LIMITS.candidate.skills.min, 'Add at least 3 skills.'),
    experienceCount: z.number().int().min(1, 'Add at least one previous role.'),
    hasResume: z.literal(true, { errorMap: () => ({ message: 'Upload your CV before submitting.' }) }),
  })
  .refine((v) => v.expectedSalaryMaxLpa >= v.expectedSalaryMinLpa, {
    message: 'Maximum expected salary cannot be below the minimum.',
    path: ['expectedSalaryMaxLpa'],
  });

/**
 * Editing one of these on an APPROVED profile sends it back for re-review and
 * pauses job browsing. Everything else applies immediately.
 *
 * The split is about what our team actually assessed: they approved a person's
 * skills, experience and seniority. A new phone number does not change that
 * judgement; a rewritten career summary does.
 */
export const MATERIAL_FIELDS = [
  'skills',
  'experiences',
  'yearsOfExperience',
  'sectorSlug',
  'functionSlug',
  'educationLevel',
  'qualification',
  'qualificationYear',
  'careerSummary',
  'currentJobTitle',
  'currentSalaryLpa',
  'expectedSalaryMinLpa',
  'expectedSalaryMaxLpa',
  'resume',
] as const;
export type MaterialField = (typeof MATERIAL_FIELDS)[number];

export const NON_MATERIAL_FIELDS = [
  'fullName',
  'mobile',
  'citySlug',
  'state',
  'openToRelocation',
  'currentEmployer',
  'noticePeriod',
  'employmentPreference',
  'linkedinUrl',
] as const;

export function isMaterialField(field: string): boolean {
  return (MATERIAL_FIELDS as readonly string[]).includes(field);
}

export function materialFieldsIn(changed: readonly string[]): string[] {
  return changed.filter(isMaterialField);
}

/**
 * Completion weights. Exported so the progress bar the candidate sees and the
 * number the admin sorts by are the same calculation.
 */
export const COMPLETION_WEIGHTS: Readonly<Record<string, number>> = {
  fullName: 4,
  mobile: 4,
  citySlug: 4,
  state: 3,
  currentJobTitle: 6,
  yearsOfExperience: 6,
  sectorSlug: 6,
  functionSlug: 6,
  educationLevel: 5,
  qualification: 4,
  qualificationYear: 3,
  careerSummary: 15,
  noticePeriod: 5,
  employmentPreference: 4,
  currentSalaryLpa: 4,
  expectedSalaryMinLpa: 4,
  expectedSalaryMaxLpa: 3,
  skills: 8,
  experiences: 6,
  resume: 10,
};

export const COMPLETION_TOTAL = Object.values(COMPLETION_WEIGHTS).reduce((a, b) => a + b, 0);

/** Steps in the wizard, used for both navigation and per-step validation. */
export const PROFILE_STEPS = [
  { id: 'basic', label: 'About you', fields: ['fullName', 'mobile', 'citySlug', 'state', 'openToRelocation'] },
  {
    id: 'professional',
    label: 'Professional',
    fields: [
      'currentJobTitle',
      'currentEmployer',
      'yearsOfExperience',
      'sectorSlug',
      'functionSlug',
      'educationLevel',
      'qualification',
      'qualificationYear',
      'skills',
    ],
  },
  { id: 'history', label: 'Career history', fields: ['experiences'] },
  {
    id: 'summary',
    label: 'Summary & availability',
    fields: ['careerSummary', 'noticePeriod', 'employmentPreference', 'linkedinUrl'],
  },
  {
    id: 'salary',
    label: 'Salary & CV',
    fields: ['currentSalaryLpa', 'expectedSalaryMinLpa', 'expectedSalaryMaxLpa', 'resume'],
  },
] as const;

export type ProfileStepId = (typeof PROFILE_STEPS)[number]['id'];
