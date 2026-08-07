/**
 * Candidate profile use cases.
 */

import {
  COMPLETION_WEIGHTS,
  COMPLETION_TOTAL,
  lpaToRupees,
  materialFieldsIn,
  nowIso,
  submitProfileSchema,
  type UpdateProfileInput,
} from '@bktc/shared';
import { transaction } from '../../repositories/tx.js';
import * as candidateRepo from '../../repositories/candidate.repo.js';
import * as taxonomyRepo from '../../repositories/taxonomy.repo.js';
import * as fileRepo from '../../repositories/file.repo.js';
import { badRequest, notFound } from '../../lib/errors.js';
import type { CandidateRelations } from '../../serializers/candidate.serializer.js';
import type { CandidateProfileRow, Row } from '../../db/rows.js';

/** Loads the related rows every candidate view needs, batched rather than N+1. */
export function loadRelations(profile: Row<CandidateProfileRow>): CandidateRelations {
  const skillIds = candidateRepo.listSkillIds(profile.id);
  const skills = taxonomyRepo
    .listSkillsByIds(skillIds)
    .map((s) => ({ id: s.id, name: s.name }));

  const resume = profile.resume_file_id ? fileRepo.findById(profile.resume_file_id) : undefined;

  return {
    skills,
    experiences: candidateRepo.listExperiences(profile.id),
    citySlug: taxonomyRepo.slugById('city', profile.city_id),
    cityName: taxonomyRepo.nameById('city', profile.city_id),
    sectorSlug: taxonomyRepo.slugById('sector', profile.sector_id),
    sectorName: taxonomyRepo.nameById('sector', profile.sector_id),
    functionSlug: taxonomyRepo.slugById('functional_area', profile.functional_area_id),
    functionName: taxonomyRepo.nameById('functional_area', profile.functional_area_id),
    hasResume: resume !== undefined,
    resumeFileId: resume?.id ?? null,
    resumeFileName: resume?.original_name ?? null,
  };
}

export function getProfile(userId: string): Row<CandidateProfileRow> {
  const profile = candidateRepo.findByUserId(userId);
  if (!profile) throw notFound('Profile not found.');
  return profile;
}

/**
 * Recomputes the completion percentage from the weights in packages/shared, so
 * the bar the candidate sees and the number an admin sorts by are the same
 * calculation rather than two drifting implementations.
 */
function computeCompletion(
  profile: Row<CandidateProfileRow>,
  skillCount: number,
  experienceCount: number,
): number {
  const filled: Record<string, boolean> = {
    fullName: Boolean(profile.full_name),
    mobile: Boolean(profile.mobile),
    citySlug: profile.city_id != null,
    state: Boolean(profile.state),
    currentJobTitle: Boolean(profile.current_job_title),
    yearsOfExperience: profile.years_of_experience != null,
    sectorSlug: profile.sector_id != null,
    functionSlug: profile.functional_area_id != null,
    educationLevel: Boolean(profile.education_level),
    qualification: Boolean(profile.qualification),
    qualificationYear: profile.qualification_year != null,
    careerSummary: Boolean(profile.career_summary && profile.career_summary.length >= 150),
    noticePeriod: Boolean(profile.notice_period),
    employmentPreference: Boolean(profile.employment_preference),
    currentSalaryLpa: profile.current_salary != null,
    expectedSalaryMinLpa: profile.expected_salary_min != null,
    expectedSalaryMaxLpa: profile.expected_salary_max != null,
    skills: skillCount >= 3,
    experiences: experienceCount >= 1,
    resume: Boolean(profile.resume_file_id),
  };

  // Cross-field consistency counts towards completeness too. Without this the
  // bar reads 100% while Submit refuses — a full progress bar and a blocking
  // error that contradict each other.
  const salaryRangeValid =
    profile.expected_salary_min == null ||
    profile.expected_salary_max == null ||
    profile.expected_salary_max >= profile.expected_salary_min;
  if (!salaryRangeValid) filled.expectedSalaryMaxLpa = false;

  const earned = Object.entries(COMPLETION_WEIGHTS).reduce(
    (sum, [field, weight]) => sum + (filled[field] ? weight : 0),
    0,
  );
  return Math.round((earned / COMPLETION_TOTAL) * 100);
}

/** Maps the API's camelCase input onto database columns. */
function toColumns(input: UpdateProfileInput): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const set = (column: string, value: unknown) => {
    if (value !== undefined) patch[column] = value;
  };

  set('full_name', input.fullName);
  set('mobile', input.mobile);
  set('state', input.state);
  set('open_to_relocation', input.openToRelocation === undefined ? undefined : input.openToRelocation ? 1 : 0);
  set('current_job_title', input.currentJobTitle);
  set('current_employer', input.currentEmployer);
  set('years_of_experience', input.yearsOfExperience);
  set('education_level', input.educationLevel);
  set('qualification', input.qualification);
  set('qualification_year', input.qualificationYear);
  set('career_summary', input.careerSummary);
  set('notice_period', input.noticePeriod);
  set('employment_preference', input.employmentPreference);
  set('linkedin_url', input.linkedinUrl === '' ? null : input.linkedinUrl);

  // Salary arrives in LPA and is stored as whole rupees.
  if (input.currentSalaryLpa !== undefined) patch.current_salary = lpaToRupees(input.currentSalaryLpa);
  if (input.expectedSalaryMinLpa !== undefined)
    patch.expected_salary_min = lpaToRupees(input.expectedSalaryMinLpa);
  if (input.expectedSalaryMaxLpa !== undefined)
    patch.expected_salary_max = lpaToRupees(input.expectedSalaryMaxLpa);

  if (input.citySlug !== undefined) patch.city_id = taxonomyRepo.idBySlug('city', input.citySlug);
  if (input.sectorSlug !== undefined) patch.sector_id = taxonomyRepo.idBySlug('sector', input.sectorSlug);
  if (input.functionSlug !== undefined)
    patch.functional_area_id = taxonomyRepo.idBySlug('functional_area', input.functionSlug);

  return patch;
}

export interface UpdateResult {
  readonly requiresReapproval: boolean;
  readonly materialChanges: readonly string[];
}

/**
 * Applies a partial update.
 *
 * D2: on an APPROVED profile, non-material edits (phone, city, notice period)
 * apply immediately, while material edits — the things our team actually
 * assessed — send it back to SUBMITTED and pause job browsing. Without this an
 * approved candidate could never change their phone number again; with a
 * blanket re-review, updating a phone number would cost them the job list.
 */
export function updateProfile(
  userId: string,
  input: UpdateProfileInput,
  /**
   * Changes that happen outside the patch body — currently just 'resume'.
   * A replaced CV is listed in MATERIAL_FIELDS and must re-queue the profile:
   * otherwise a vetted candidate could swap in an entirely different document,
   * which then reaches employers under D1 with no second look.
   */
  extraMaterialFields: readonly string[] = [],
): UpdateResult {
  const profile = getProfile(userId);

  /*
   * Salary range sanity, checked against what will actually be stored.
   *
   * The patch is partial, so a schema-level refine only sees the fields that
   * happen to be in this request — sending only a new minimum could still
   * leave min above max. Comparing the incoming value against the stored one
   * catches every ordering. It used to be caught only at submit, so a profile
   * could sit for days reading "expecting 50–10 LPA".
   */
  const nextMin =
    input.expectedSalaryMinLpa !== undefined
      ? lpaToRupees(input.expectedSalaryMinLpa)
      : profile.expected_salary_min;
  const nextMax =
    input.expectedSalaryMaxLpa !== undefined
      ? lpaToRupees(input.expectedSalaryMaxLpa)
      : profile.expected_salary_max;

  if (nextMin != null && nextMax != null && nextMax < nextMin) {
    throw badRequest('Your maximum expectation cannot be below your minimum.', [
      { path: 'expectedSalaryMaxLpa', message: 'Must be at least your minimum.' },
    ]);
  }

  const touched = [
    ...Object.keys(input).filter((key) => input[key as keyof UpdateProfileInput] !== undefined),
    ...extraMaterialFields,
  ];
  const material = materialFieldsIn(touched);
  const wasApproved = profile.profile_status === 'APPROVED';
  const requiresReapproval = wasApproved && material.length > 0;

  transaction(() => {
    const patch = toColumns(input);
    if (Object.keys(patch).length > 0) candidateRepo.updateFields(profile.id, patch);

    if (input.skills) {
      const ids = input.skills.map((name) => taxonomyRepo.resolveSkillId(name));
      candidateRepo.replaceSkills(profile.id, ids);
    }

    if (input.experiences) {
      candidateRepo.replaceExperiences(
        profile.id,
        input.experiences.map((e) => ({
          company: e.company,
          title: e.title,
          startYear: e.startYear,
          endYear: e.isCurrent ? null : (e.endYear ?? null),
          isCurrent: e.isCurrent,
          domainTags: e.domainTags,
          keyAchievement: e.keyAchievement ?? null,
        })),
      );
    }

    const fresh = candidateRepo.findById(profile.id)!;
    const skillCount = candidateRepo.listSkillIds(profile.id).length;
    const experienceCount = candidateRepo.listExperiences(profile.id).length;
    candidateRepo.updateFields(profile.id, {
      completion_percent: computeCompletion(fresh, skillCount, experienceCount),
    });

    if (requiresReapproval) {
      candidateRepo.setStatus(profile.id, 'SUBMITTED', { submittedAt: nowIso() });
    }

    candidateRepo.touchActivity(profile.id);
  });

  return { requiresReapproval, materialChanges: material };
}

/** Validates the whole profile and moves DRAFT/CHANGES_REQUESTED to SUBMITTED. */
export function submitProfile(userId: string): void {
  const profile = getProfile(userId);

  if (profile.profile_status === 'SUBMITTED') {
    throw badRequest('Your profile is already under review.');
  }
  if (profile.profile_status === 'APPROVED') {
    throw badRequest('Your profile is already approved.');
  }

  const relations = loadRelations(profile);

  const result = submitProfileSchema.safeParse({
    fullName: profile.full_name,
    mobile: profile.mobile,
    citySlug: relations.citySlug ?? '',
    state: profile.state ?? '',
    currentJobTitle: profile.current_job_title ?? '',
    yearsOfExperience: profile.years_of_experience ?? undefined,
    sectorSlug: relations.sectorSlug ?? '',
    functionSlug: relations.functionSlug ?? '',
    educationLevel: profile.education_level ?? undefined,
    qualification: profile.qualification ?? '',
    qualificationYear: profile.qualification_year ?? undefined,
    careerSummary: profile.career_summary ?? '',
    noticePeriod: profile.notice_period ?? undefined,
    employmentPreference: profile.employment_preference ?? undefined,
    currentSalaryLpa: profile.current_salary == null ? undefined : profile.current_salary / 100_000,
    expectedSalaryMinLpa:
      profile.expected_salary_min == null ? undefined : profile.expected_salary_min / 100_000,
    expectedSalaryMaxLpa:
      profile.expected_salary_max == null ? undefined : profile.expected_salary_max / 100_000,
    skillCount: relations.skills.length,
    experienceCount: relations.experiences.length,
    hasResume: relations.hasResume,
  });

  if (!result.success) {
    // "Not complete" is wrong when every field is filled and one value is
    // simply inconsistent — say which it is.
    const onlyInconsistent = result.error.issues.every((i) => i.code === 'custom');
    throw badRequest(
      onlyInconsistent
        ? 'One thing needs fixing before we can review this.'
        : 'Your profile is not complete yet.',
      result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    );
  }

  candidateRepo.setStatus(profile.id, 'SUBMITTED', { submittedAt: nowIso() });
}
