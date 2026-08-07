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
  readonly resumeFileId: string | null;
  readonly resumeFileName: string | null;
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
    /*
     * linkedinUrl is NOT here.
     *
     * It is a working direct-contact channel — the whole managed model, and
     * BK's fee, rests on employers not having one. It sat in the fields every
     * audience shares, so every employer with an application received it from
     * APPLIED onward, while the candidate's own privacy page told them in
     * writing that employers see none of their contact details.
     *
     * The mirror case was already handled for the EMPLOYER's linkedin and
     * website (MATERIAL_EMPLOYER_FIELDS in schemas/job.ts); this direction was
     * missed. It now belongs to the self and admin views only.
     */
    skills: rel.skills,
    experiences: rel.experiences.map(toExperienceView),
    hasResume: rel.hasResume,
  };
}

export function toSelfView(row: Row<CandidateProfileRow>, rel: CandidateRelations) {
  const c = unbrand(row);
  return {
    ...commonFields(row, rel),
    mobile: c.mobile,
    // Their own link, on their own profile.
    linkedinUrl: c.linkedin_url,
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
/**
 * Load-bearing, unlike the other view aliases: application.serializer.ts takes
 * this as a parameter type, which is what stops an application payload being
 * built from anything less careful than the employer candidate view.
 */
export type EmployerCandidateView = ReturnType<typeof toEmployerView>;

export function toEmployerView(row: Row<CandidateProfileRow>, rel: CandidateRelations) {
  // No mobile. No email. No LinkedIn. No salary of any kind. No review notes.
  // Every contact route runs through the BK team.
  return commonFields(row, rel);
}

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
    // Admin-only, alongside email and mobile: BK verifies people, and every
    // contact route runs through them.
    linkedinUrl: c.linkedin_url,
    userStatus: extra.userStatus,
    // The account behind the profile, so the admin can suspend from the
    // screen where they are already looking at the person.
    userId: c.user_id,
    currentSalaryLpa: c.current_salary == null ? null : rupeesToLpa(c.current_salary),
    expectedSalaryMinLpa: c.expected_salary_min == null ? null : rupeesToLpa(c.expected_salary_min),
    expectedSalaryMaxLpa: c.expected_salary_max == null ? null : rupeesToLpa(c.expected_salary_max),
    profileStatus: c.profile_status,
    submittedAt: c.submitted_at,
    reviewedAt: c.reviewed_at,
    reviewNote: c.review_note,
    completionPercent: c.completion_percent,
    // The admin is the party vetting this person; withholding the CV meant the
    // approval gate — the product's whole value — was exercised blind.
    resumeFileId: rel.resumeFileId,
    resumeFileName: rel.resumeFileName,
    consentedAt: c.consented_at,
    consentVersion: c.consent_version,
    lastActiveAt: c.last_active_at,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  };
}
