/**
 * Enum constants — the single source of truth for both the SQLite CHECK
 * constraints / lookup-table seeds and the zod validation on both sides.
 *
 * Never inline one of these string literals anywhere else. The DDL is generated
 * from these lists, so a divergence is a runtime constraint violation, not a
 * type error.
 */

export const ROLES = ['CANDIDATE', 'EMPLOYER', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const USER_STATUSES = ['ACTIVE', 'SUSPENDED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/**
 * Review status shared by candidate profiles, employer accounts and jobs.
 * Stored in a lookup table rather than a CHECK constraint: SQLite cannot ALTER
 * a CHECK, and these are the values most likely to gain a member later.
 */
export const REVIEW_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'CHANGES_REQUESTED',
  'REJECTED',
] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/**
 * Admin list priority order, per the product requirement: review queues should
 * surface what needs a decision first, then what's already resolved, with
 * rejected work sinking to the bottom. "Awaiting review" collapses the two
 * differently-named pending statuses (SUBMITTED for candidates/employers,
 * PENDING_APPROVAL for jobs) into the same rank 1, since the source requirement
 * named them as one tier, not two.
 *
 * A status not listed here (a future addition) falls back to UNKNOWN_STATUS_PRIORITY
 * so it stays visible and sorts deterministically last, rather than disappearing
 * or crashing the ORDER BY.
 */
export const REVIEW_STATUS_PRIORITY: Record<ReviewStatus, number> = {
  SUBMITTED: 1,
  APPROVED: 2,
  CHANGES_REQUESTED: 3,
  DRAFT: 4,
  REJECTED: 5,
};

export const JOB_STATUSES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'CHANGES_REQUESTED',
  'REJECTED',
  'CLOSED',
  'FILLED',
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/** Same ranking idea as REVIEW_STATUS_PRIORITY, for the job-posting queue's own status set. */
export const JOB_STATUS_PRIORITY: Record<JobStatus, number> = {
  PENDING_APPROVAL: 1,
  APPROVED: 2,
  CHANGES_REQUESTED: 3,
  DRAFT: 4,
  REJECTED: 5,
  CLOSED: 6,
  FILLED: 6,
};

/** Fallback rank for any status value absent from the priority map above. */
export const UNKNOWN_STATUS_PRIORITY = 99;

/** Job statuses that are publicly visible. Used by every public/candidate query. */
export const PUBLICLY_VISIBLE_JOB_STATUSES = ['APPROVED'] as const satisfies readonly JobStatus[];

export const WORK_TYPES = ['ONSITE', 'HYBRID', 'REMOTE'] as const;
export type WorkType = (typeof WORK_TYPES)[number];

export const NOTICE_PERIODS = ['IMMEDIATE', 'D15', 'D30', 'D60', 'D90'] as const;
export type NoticePeriod = (typeof NOTICE_PERIODS)[number];

export const NOTICE_PERIOD_LABELS: Record<NoticePeriod, string> = {
  IMMEDIATE: 'Immediate',
  D15: '15 days',
  D30: '30 days',
  D60: '60 days',
  D90: '90 days',
};

/**
 * Candidate's own highest qualification. Superset of the job requirement list.
 *
 * DEGREE/POSTGRADUATE/OTHER were added alongside BE/BTECH/MTECH/MBA rather
 * than instead of them: BE and BTECH already ranked identically in
 * EDUCATION_RANK below, as did MTECH and MBA, so DEGREE/POSTGRADUATE are not
 * new concepts — they are what the candidate-facing form now calls that same
 * rank, via CANDIDATE_EDUCATION_LEVEL_OPTIONS. The legacy four stay valid so
 * every already-saved profile keeps reading correctly; new candidate
 * submissions use the five-option list instead.
 */
export const EDUCATION_LEVELS = [
  'DIPLOMA',
  'BE',
  'BTECH',
  'MTECH',
  'MBA',
  'PHD',
  'DEGREE',
  'POSTGRADUATE',
  'OTHER',
] as const;
export type EducationLevel = (typeof EDUCATION_LEVELS)[number];

/** The reduced list the candidate profile form actually offers for a new selection. */
export const CANDIDATE_EDUCATION_LEVEL_OPTIONS = [
  'DIPLOMA',
  'DEGREE',
  'POSTGRADUATE',
  'PHD',
  'OTHER',
] as const;

/** What a job asks for. Includes ANY; excludes MBA/PHD per Proposal p5. */
export const EDUCATION_REQUIREMENTS = ['ANY', 'DIPLOMA', 'BE', 'BTECH', 'MTECH'] as const;
export type EducationRequirement = (typeof EDUCATION_REQUIREMENTS)[number];

export const EDUCATION_LABELS: Record<EducationLevel | 'ANY', string> = {
  ANY: 'Any',
  DIPLOMA: 'Diploma',
  BE: 'B.E.',
  BTECH: 'B.Tech',
  MTECH: 'M.Tech',
  MBA: 'MBA',
  PHD: 'Doctorate',
  DEGREE: 'Degree',
  POSTGRADUATE: 'Postgraduate',
  OTHER: 'Other',
};

/**
 * Ranking used to decide whether a candidate's education satisfies a job's
 * requirement. Phase 2's matcher needs this; Phase 1 only displays it, but the
 * ordering has to be decided once, here, rather than reinvented later.
 */
const EDUCATION_RANK: Record<EducationLevel, number> = {
  DIPLOMA: 1,
  BE: 2,
  BTECH: 2,
  DEGREE: 2,
  MTECH: 3,
  MBA: 3,
  POSTGRADUATE: 3,
  PHD: 4,
  OTHER: 1,
};

export function educationSatisfies(
  candidate: EducationLevel,
  required: EducationRequirement,
): boolean {
  if (required === 'ANY') return true;
  const requiredRank = EDUCATION_RANK[required as EducationLevel];
  return EDUCATION_RANK[candidate] >= requiredRank;
}

export const EMPLOYMENT_PREFERENCES = ['FULL_TIME', 'CONTRACT', 'BOTH'] as const;
export type EmploymentPreference = (typeof EMPLOYMENT_PREFERENCES)[number];

export const SKILL_REQUIREMENTS = ['REQUIRED', 'GOOD_TO_HAVE'] as const;
export type SkillRequirement = (typeof SKILL_REQUIREMENTS)[number];

export const APPLICATION_SOURCES = ['APPLIED', 'ADMIN_RECOMMENDED'] as const;
export type ApplicationSource = (typeof APPLICATION_SOURCES)[number];

export const INTERVIEW_MODES = ['PHONE', 'VIDEO', 'ONSITE'] as const;
export type InterviewMode = (typeof INTERVIEW_MODES)[number];

export const INTERVIEW_STATUSES = ['SCHEDULED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED'] as const;
export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];

export const NOTE_ENTITY_TYPES = ['CANDIDATE', 'EMPLOYER', 'JOB', 'APPLICATION'] as const;
export type NoteEntityType = (typeof NOTE_ENTITY_TYPES)[number];

export const ENQUIRY_TYPES = ['CANDIDATE', 'EMPLOYER', 'OTHER'] as const;
export type EnquiryType = (typeof ENQUIRY_TYPES)[number];

/**
 * Why an application ended without an offer. Structured rather than free text
 * because Phase 2 reports "rejection reason breakdown by stage", which cannot
 * be reconstructed from a note field after the fact.
 */
export const OUTCOME_REASON_CODES = [
  'SKILLS_MISMATCH',
  'EXPERIENCE_MISMATCH',
  'SALARY_MISMATCH',
  'LOCATION_MISMATCH',
  'NOTICE_PERIOD',
  'CANDIDATE_UNRESPONSIVE',
  'CANDIDATE_DECLINED',
  'POSITION_FILLED',
  'JOB_CLOSED',
  'OTHER',
] as const;
export type OutcomeReasonCode = (typeof OUTCOME_REASON_CODES)[number];
