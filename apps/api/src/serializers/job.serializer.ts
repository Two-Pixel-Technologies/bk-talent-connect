/**
 * Job serializers — the second privacy boundary.
 *
 * The salary band is confidential to the admin team and the employer who owns
 * the posting. It must never reach a candidate or a public page, in the same
 * way a candidate's expectations must never reach an employer.
 *
 * Public and candidate views additionally omit employer identity: the proposal
 * specifies "a searchable list of Anonymous open roles", and the company is
 * revealed only once an application reaches shortlist.
 *
 *   toPublicView          anonymous, no salary, no employer
 *   toCandidateView       same, plus whether this candidate has applied (P5)
 *   toEmployerOwnerView   full, including the salary band
 *   toAdminView           everything, plus review state and contact flags
 *
 * Built by naming what IS included rather than spreading the row and deleting
 * fields — an omission list is one careless edit away from leaking.
 */

import { rupeesToLpa, type ContactFinding, type WorkType } from '@bktc/shared';
import type { JobRow, Row } from '../db/rows.js';
import { unbrand } from '../db/rows.js';

export type JobSkillView = { readonly id: number; readonly name: string };

export type JobLocationView = { readonly citySlug: string | null; readonly cityName: string | null; readonly state: string };

export type JobRelations = {
  readonly requiredSkills: readonly JobSkillView[];
  readonly goodToHaveSkills: readonly JobSkillView[];
  readonly sectorSlug: string | null;
  readonly sectorName: string | null;
  readonly functionSlug: string | null;
  readonly functionName: string | null;
  readonly citySlug: string | null;
  readonly cityName: string | null;
  /** Hiring locations beyond the primary citySlug/cityName/state above. */
  readonly additionalLocations: readonly JobLocationView[];
  readonly employerName: string;
  readonly employerProfileId: string;
};

/** Safe for every audience. Contains nothing confidential. */
function commonFields(row: Row<JobRow>, rel: JobRelations) {
  const j = unbrand(row);
  return {
    id: j.id,
    title: j.title,
    department: j.department,
    numberOfPositions: j.number_of_positions,
    sectorSlug: rel.sectorSlug,
    sectorName: rel.sectorName,
    functionSlug: rel.functionSlug,
    functionName: rel.functionName,
    citySlug: rel.citySlug,
    cityName: rel.cityName,
    state: j.state,
    additionalLocations: rel.additionalLocations,
    workType: j.work_type as WorkType | null,
    minExperience: j.min_experience,
    maxExperience: j.max_experience,
    educationRequirement: j.education_requirement,
    description: j.description,
    targetJoiningDate: j.target_joining_date,
    requiredSkills: rel.requiredSkills,
    goodToHaveSkills: rel.goodToHaveSkills,
    publishedAt: j.published_at,
  };
}

/** Anonymous listing. No salary band, no employer identity. */
export function toPublicView(row: Row<JobRow>, rel: JobRelations) {
  return commonFields(row, rel);
}

/** Same as public today; diverges in P5 when application state is attached. */
export function toCandidateView(row: Row<JobRow>, rel: JobRelations) {
  return commonFields(row, rel);
}

/** The owning employer: their own posting, salary band included. */
export function toEmployerOwnerView(row: Row<JobRow>, rel: JobRelations) {
  const j = unbrand(row);
  return {
    ...commonFields(row, rel),
    employerName: rel.employerName,
    salaryBandMinLpa: j.salary_band_min == null ? null : rupeesToLpa(j.salary_band_min),
    salaryBandMaxLpa: j.salary_band_max == null ? null : rupeesToLpa(j.salary_band_max),
    status: j.status,
    reviewNote: j.review_note,
    reviewedAt: j.reviewed_at,
    closedAt: j.closed_at,
    createdAt: j.created_at,
    updatedAt: j.updated_at,
  };
}

export function toAdminView(row: Row<JobRow>, rel: JobRelations) {
  const j = unbrand(row);

  let contactFlags: ContactFinding[] = [];
  try {
    contactFlags = j.contact_flags ? (JSON.parse(j.contact_flags) as ContactFinding[]) : [];
  } catch {
    contactFlags = [];
  }

  return {
    ...toEmployerOwnerView(row, rel),
    employerProfileId: rel.employerProfileId,
    // Contact details found in the description. The reviewer decides — a
    // description can legitimately contain digits.
    contactFlags,
    reviewedById: j.reviewed_by_id,
  };
}
