/**
 * Candidate serializers — the privacy boundary.
 *
 * Three audiences, three shapes. The differences are not cosmetic:
 *
 *   toSelfView     candidate's own data, salary included (it is theirs)
 *   toEmployerView NO salary, NO email, NO mobile — all candidate contact is
 *                  routed through admins, and salary expectations are the one
 *                  thing the proposal marks private in both directions
 *   toAdminView    everything, because admins are the only role that can see
 *                  both a candidate's expectations and an employer's band
 *
 * tests/privacy.test.ts asserts the employer view contains none of the banned
 * keys, and is written so that re-adding one makes it fail.
 */

import {
  rupeesToLpa,
  type EducationLevel,
  type EmploymentPreference,
  type NoticePeriod,
} from '@bktc/shared';
import type { CandidateProfileRow, CandidateExperienceRow, Row } from '../db/rows.js';
import { unbrand } from '../db/rows.js';

export type SkillView = { readonly id: number; readonly name: string };

export type ExperienceView = {
  readonly id: string;
  readonly company: string;
  readonly title: string;
  readonly startYear: number;
  readonly endYear: number | null;
  readonly isCurrent: boolean;
  readonly domainTags: readonly string[];
  readonly keyAchievement: string | null;
};

export type CandidateRelations = {
  readonly skills: readonly SkillView[];
  readonly experiences: readonly Row<CandidateExperienceRow>[];
  readonly citySlug: string | null;
  readonly cityName: string | null;
  readonly sectorSlug: string | null;
  readonly sectorName: string | null;
  readonly functionSlug: string | null;
  readonly functionName: string | null;
  readonly hasResume: boolean;
};

function toExperienceView(row: Row<CandidateExperienceRow>): ExperienceView {
  const e = unbrand(row);
  let domainTags: string[] = [];
  try {
    domainTags = e.domain_tags ? (JSON.parse(e.domain_tags) as string[]) : [];
  } catch {
    domainTags = [];
  }
  return {
    id: e.id,
    company: e.company,
    title: e.title,
    startYear: e.start_year,
    endYear: e.end_year,
    isCurrent: e.is_current === 1,
    domainTags,
    keyAchievement: e.key_achievement,
  };
}

/** Fields every audience may see. */
function commonFields(row: Row<CandidateProfileRow>, rel: CandidateRelations) {
  const c = unbrand(row);
  return {
    id: c.id,
    fullName: c.full_name,
    citySlug: rel.citySlug,
    cityName: rel.cityName,
    state: c.state,
    openToRelocation: c.open_to_relocation === 1,
    currentJobTitle: c.current_job_title,
    currentEmployer: c.current_employer,
    yearsOfExperience: c.years_of_experience,
    sectorSlug: rel.sectorSlug,
    sectorName: rel.sectorName,
    functionSlug: rel.functionSlug,
    functionName: rel.functionName,
    educationLevel: c.education_level as EducationLevel | null,
    qualification: c.qualification,
    qualificationYear: c.qualification_year,
    careerSummary: c.career_summary,
    noticePeriod: c.notice_period as NoticePeriod | null,
    employmentPreference: c.employment_preference as EmploymentPreference | null,
    linkedinUrl: c.linkedin_url,
    skills: rel.skills,
    experiences: rel.experiences.map(toExperienceView),
    hasResume: rel.hasResume,
  };
}

export type SelfCandidateView = ReturnType<typeof toSelfView>;

export function toSelfView(row: Row<CandidateProfileRow>, rel: CandidateRelations) {
  const c = unbrand(row);
  return {
    ...commonFields(row, rel),
    mobile: c.mobile,
    // The candidate's own figures, shown back in LPA as they entered them.
    currentSalaryLpa: c.current_salary == null ? null : rupeesToLpa(c.current_salary),
    expectedSalaryMinLpa: c.expected_salary_min == null ? null : rupeesToLpa(c.expected_salary_min),
    expectedSalaryMaxLpa: c.expected_salary_max == null ? null : rupeesToLpa(c.expected_salary_max),
    profileStatus: c.profile_status,
    submittedAt: c.submitted_at,
    reviewedAt: c.reviewed_at,
    reviewNote: c.review_note,
    completionPercent: c.completion_percent,
    consentedAt: c.consented_at,
    updatedAt: c.updated_at,
  };
}

/**
 * What an employer sees. Deliberately built by listing what IS included rather
 * than deleting what is not — a spread of the row with omissions is one careless
 * edit away from leaking.
 */
export type EmployerCandidateView = ReturnType<typeof toEmployerView>;

export function toEmployerView(row: Row<CandidateProfileRow>, rel: CandidateRelations) {
  // No mobile. No email. No salary of any kind. No admin review notes.
  return commonFields(row, rel);
}

export type AdminCandidateView = ReturnType<typeof toAdminView>;

export function toAdminView(
  row: Row<CandidateProfileRow>,
  rel: CandidateRelations,
  extra: { readonly email: string; readonly userStatus: string },
) {
  const c = unbrand(row);
  return {
    ...commonFields(row, rel),
    email: extra.email,
    mobile: c.mobile,
    userStatus: extra.userStatus,
    currentSalaryLpa: c.current_salary == null ? null : rupeesToLpa(c.current_salary),
    expectedSalaryMinLpa: c.expected_salary_min == null ? null : rupeesToLpa(c.expected_salary_min),
    expectedSalaryMaxLpa: c.expected_salary_max == null ? null : rupeesToLpa(c.expected_salary_max),
    profileStatus: c.profile_status,
    submittedAt: c.submitted_at,
    reviewedAt: c.reviewed_at,
    reviewNote: c.review_note,
    completionPercent: c.completion_percent,
    consentedAt: c.consented_at,
    consentVersion: c.consent_version,
    lastActiveAt: c.last_active_at,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  };
}
