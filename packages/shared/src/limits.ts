/**
 * Input bounds. Every zod schema draws its .min()/.max() from here.
 *
 * v1 of the plan specified minimums (3 skills, 150 chars, 100 words) and not a
 * single maximum, which left the shared Skill table open to being permanently
 * polluted by one authenticated account.
 *
 * Plan reference: HIGH-16.
 */

export const LIMITS = {
  /** Request body cap. Resume uploads go through multipart, not JSON. */
  jsonBodyBytes: 100 * 1024,

  email: { max: 254 },
  password: { min: 8, max: 128 },
  shortText: { max: 200 },
  mobile: { min: 10, max: 15 },
  url: { max: 500 },

  candidate: {
    fullName: { min: 2, max: 120 },
    careerSummary: { min: 150, max: 2000 },
    skills: { min: 3, max: 10 },
    experienceRows: { max: 15 },
    /** "Summary of Work Done" — a paragraph, not the one-line achievement this used to be. */
    keyAchievement: { max: 1200 },
    yearsOfExperience: { min: 0, max: 60 },
    sectorOther: { max: 100 },
    educationLevelOther: { max: 100 },
  },

  employer: {
    companyName: { min: 2, max: 150 },
    companyIntro: { min: 50, max: 2000 },
    locations: { max: 10 },
  },

  job: {
    title: { min: 3, max: 150 },
    department: { max: 100 },
    /** Word counts, not characters — the proposal specifies "min 100 words". */
    descriptionWords: { min: 100, max: 1000 },
    descriptionChars: { max: 12000 },
    requiredSkills: { min: 3, max: 15 },
    goodToHaveSkills: { max: 15 },
    numberOfPositions: { min: 1, max: 999 },
    experienceYears: { min: 0, max: 60 },
    /** Beyond the one required primary location — extra branches hiring for the same role. */
    additionalLocations: { max: 9 },
  },

  /** Salary in whole rupees per annum. 1 crore ceiling is a sanity bound. */
  salary: { min: 0, max: 100_000_000 },

  note: { max: 4000 },
  reviewNote: { min: 5, max: 2000 },

  resume: {
    maxBytes: 5 * 1024 * 1024,
    allowedMimeTypes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ],
    allowedExtensions: ['.pdf', '.docx', '.doc'],
  },

  pagination: { defaultPageSize: 20, maxPageSize: 100 },

  session: {
    /** Sliding expiry, refreshed on activity. */
    lifetimeMs: 30 * 24 * 60 * 60 * 1000,
    /** Session rows older than this are deleted by the nightly cron (DPDP). */
    retentionMs: 90 * 24 * 60 * 60 * 1000,
  },
} as const;

/** Word count used for the job description bound. */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}
