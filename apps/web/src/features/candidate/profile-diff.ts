/**
 * Diffing the wizard draft against the saved profile.
 *
 * This exists because sending the whole draft on every save is subtly wrong.
 * The server decides whether an approved profile needs re-review from which
 * fields are PRESENT in the patch — so a payload that always carries `skills`
 * and `careerSummary` sends the candidate back into review even when they only
 * corrected a phone number. That is exactly the behaviour D2 was designed to
 * avoid.
 *
 * Comparison is driven by one table so a newly added field cannot be silently
 * left out of the diff, which would make it impossible to save.
 */

import type { UpdateProfileInput } from '@bktc/shared';
import type { CandidateProfile } from './use-profile.js';

type Draft = UpdateProfileInput;

/** Saved value for each draft key, normalised to the draft's own shape. */
function savedValues(profile: CandidateProfile): Draft {
  return {
    fullName: profile.fullName,
    mobile: profile.mobile,
    citySlug: profile.citySlug ?? undefined,
    state: profile.state ?? undefined,
    openToRelocation: profile.openToRelocation,
    currentJobTitle: profile.currentJobTitle ?? undefined,
    currentEmployer: profile.currentEmployer ?? undefined,
    yearsOfExperience: profile.yearsOfExperience ?? undefined,
    sectorSlug: profile.sectorSlug ?? undefined,
    sectorOther: profile.sectorOther ?? undefined,
    functionSlug: profile.functionSlug ?? undefined,
    educationLevel: (profile.educationLevel as Draft['educationLevel']) ?? undefined,
    educationLevelOther: profile.educationLevelOther ?? undefined,
    qualification: profile.qualification ?? undefined,
    qualificationYear: profile.qualificationYear ?? undefined,
    careerSummary: profile.careerSummary ?? undefined,
    noticePeriod: (profile.noticePeriod as Draft['noticePeriod']) ?? undefined,
    employmentPreference: (profile.employmentPreference as Draft['employmentPreference']) ?? undefined,
    currentSalaryLpa: profile.currentSalaryLpa ?? undefined,
    expectedSalaryMinLpa: profile.expectedSalaryMinLpa ?? undefined,
    expectedSalaryMaxLpa: profile.expectedSalaryMaxLpa ?? undefined,
    linkedinUrl: profile.linkedinUrl ?? undefined,
    skills: profile.skills.map((s) => s.name),
    experiences: profile.experiences.map((e) => ({
      company: e.company,
      title: e.title,
      startYear: e.startYear,
      endYear: e.endYear,
      isCurrent: e.isCurrent,
      domainTags: e.domainTags,
      keyAchievement: e.keyAchievement ?? undefined,
    })),
  };
}

/** Seeds the wizard from the saved profile. Same shape as the diff baseline. */
export function draftFromProfile(profile: CandidateProfile): Draft {
  return savedValues(profile);
}

/** Treats '' and undefined as the same, so clearing an empty field is not a change. */
function isBlank(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

function equal(a: unknown, b: unknown): boolean {
  if (isBlank(a) && isBlank(b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
  }
  return a === b;
}

export type ProfileDiff = {
  /** Only the fields that actually changed — this is what gets sent. */
  readonly patch: Draft;
  readonly changedFields: readonly string[];
};

export function diffProfile(draft: Draft, profile: CandidateProfile): ProfileDiff {
  const saved = savedValues(profile);
  const patch: Record<string, unknown> = {};
  const changedFields: string[] = [];

  for (const key of Object.keys(saved) as (keyof Draft)[]) {
    const next = draft[key];
    // A key the wizard has not populated yet is not a deletion.
    if (next === undefined && saved[key] === undefined) continue;
    if (!equal(next, saved[key])) {
      changedFields.push(key);
      patch[key] = next;
    }
  }

  return { patch: patch as Draft, changedFields };
}
