/**
 * The exact shape of every audience's view.
 *
 * WHY THIS EXISTS
 *
 * Three separate audits found the same class of defect: a field added to a
 * shared helper and silently inherited by an audience that should never have
 * seen it. The candidate's `linkedinUrl` sat in `commonFields()` and reached
 * every employer from APPLIED onward — a working direct-contact channel, in a
 * product whose entire fee rests on employers not having one.
 *
 * Nothing caught it. The privacy suite checked for `email` and `mobile` BY
 * VALUE, so a third contact channel with a different name walked straight past.
 * The reviewer did not catch it either, because adding one line to a shared
 * helper does not look like a privacy change at the diff.
 *
 * So this test does not check for known-bad fields. It pins the COMPLETE key
 * set of every view. Adding any field to any serializer fails here by name,
 * and the person adding it has to decide, explicitly and in a diff a reviewer
 * will notice, which audiences may see it.
 *
 * When this fails: read the diff it prints. If the new field genuinely belongs
 * to that audience, add it to the list below. If it does not, you have just
 * been stopped from shipping a leak.
 */

import { describe, it, expect } from 'vitest';
import {
  toEmployerView as toEmployerCandidateView,
  toSelfView as toSelfCandidateView,
  toAdminView as toAdminCandidateView,
  type CandidateRelations,
} from '../src/serializers/candidate.serializer.js';
import {
  toPublicView as toPublicJobView,
  toCandidateView as toCandidateJobView,
  toEmployerOwnerView,
  toAdminView as toAdminJobView,
  type JobRelations,
} from '../src/serializers/job.serializer.js';
import type { CandidateProfileRow, JobRow, Row } from '../src/db/rows.js';

// --- Fixtures -------------------------------------------------------------
//
// Every column populated, so a field cannot hide behind a null.

const candidateRow = {
  id: 'c1',
  user_id: 'u1',
  full_name: 'Test Candidate',
  mobile: '9876543210',
  city_id: 1,
  state: 'Maharashtra',
  open_to_relocation: 1,
  current_job_title: 'Engineer',
  current_employer: 'ACME',
  years_of_experience: 8,
  sector_id: 1,
  sector_other: null,
  functional_area_id: 1,
  education_level: 'BTECH',
  education_level_other: null,
  qualification: 'B.Tech',
  qualification_year: 2016,
  career_summary: 'Summary',
  notice_period: 'D30',
  employment_preference: 'FULL_TIME',
  current_salary: 1_200_000,
  expected_salary_min: 1_800_000,
  expected_salary_max: 2_200_000,
  linkedin_url: 'https://linkedin.com/in/test',
  resume_file_id: 'f1',
  profile_status: 'APPROVED',
  submitted_at: '2026-01-01T00:00:00.000Z',
  reviewed_at: '2026-01-02T00:00:00.000Z',
  reviewed_by_id: 'a1',
  review_note: 'Looks good',
  completion_percent: 100,
  consented_at: '2026-01-01T00:00:00.000Z',
  consent_version: '2026-08-v1',
  last_active_at: '2026-01-03T00:00:00.000Z',
  last_approved_snapshot: '{}',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
} as unknown as Row<CandidateProfileRow>;

const candidateRelations: CandidateRelations = {
  citySlug: 'pune',
  cityName: 'Pune',
  sectorSlug: 'x',
  sectorName: 'X',
  functionSlug: 'y',
  functionName: 'Y',
  skills: [{ id: 1, name: 'HAZOP' }],
  experiences: [],
  hasResume: true,
};

const jobRow = {
  id: 'j1',
  employer_profile_id: 'e1',
  title: 'Engineer',
  department: 'Production',
  number_of_positions: 2,
  sector_id: 1,
  functional_area_id: 1,
  city_id: 1,
  state: 'Maharashtra',
  work_type: 'ONSITE',
  min_experience: 3,
  max_experience: 8,
  education_requirement: 'BTECH',
  description: 'A description',
  target_joining_date: '2026-06-01',
  salary_band_min: 2_000_000,
  salary_band_max: 2_800_000,
  status: 'APPROVED',
  published_at: '2026-01-01T00:00:00.000Z',
  reviewed_at: null,
  reviewed_by_id: null,
  review_note: null,
  contact_flags: null,
  closed_at: null,
  last_approved_snapshot: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
} as unknown as Row<JobRow>;

const jobRelations: JobRelations = {
  requiredSkills: [{ id: 1, name: 'HAZOP' }],
  goodToHaveSkills: [],
  sectorSlug: 'x',
  sectorName: 'X',
  functionSlug: 'y',
  functionName: 'Y',
  citySlug: 'pune',
  cityName: 'Pune',
  additionalLocations: [{ citySlug: 'mumbai', cityName: 'Mumbai', state: 'Maharashtra' }],
  employerName: 'ACME Industries',
  employerProfileId: 'e1',
};

// --- The contracts --------------------------------------------------------

const CANDIDATE_COMMON = [
  'id',
  'fullName',
  'citySlug',
  'cityName',
  'state',
  'openToRelocation',
  'currentJobTitle',
  'currentEmployer',
  'yearsOfExperience',
  'sectorSlug',
  'sectorName',
  'sectorOther',
  'functionSlug',
  'functionName',
  'educationLevel',
  'educationLevelOther',
  'qualification',
  'qualificationYear',
  'careerSummary',
  'noticePeriod',
  'employmentPreference',
  'skills',
  'experiences',
  'hasResume',
];

/** Anything here in an employer's payload is a way to reach the candidate. */
const CONTACT_FIELDS = ['mobile', 'email', 'phone', 'linkedinUrl', 'whatsapp'];

/** Anything here in a candidate's or employer's payload is a salary leak. */
const CANDIDATE_MONEY_FIELDS = [
  'currentSalaryLpa',
  'expectedSalaryMinLpa',
  'expectedSalaryMaxLpa',
];

function keysOf(value: object): string[] {
  return Object.keys(value).sort();
}

function expectExactly(actual: object, expected: readonly string[], label: string): void {
  const got = keysOf(actual);
  const want = [...expected].sort();

  const added = got.filter((k) => !want.includes(k));
  const removed = want.filter((k) => !got.includes(k));

  expect(
    { added, removed },
    `${label} changed shape.\n` +
      `  fields added:   ${added.join(', ') || '(none)'}\n` +
      `  fields removed: ${removed.join(', ') || '(none)'}\n` +
      `Decide deliberately whether this audience may see them, then update this list.`,
  ).toEqual({ added: [], removed: [] });
}

describe('what an employer may see about a candidate', () => {
  const view = toEmployerCandidateView(candidateRow, candidateRelations);

  it('is exactly the common fields and nothing more', () => {
    expectExactly(view, CANDIDATE_COMMON, 'toEmployerView(candidate)');
  });

  it('carries no route to contact the candidate', () => {
    for (const field of CONTACT_FIELDS) {
      expect(Object.keys(view), `employer view exposed ${field}`).not.toContain(field);
    }
  });

  it('carries no salary of any kind', () => {
    for (const field of CANDIDATE_MONEY_FIELDS) {
      expect(Object.keys(view), `employer view exposed ${field}`).not.toContain(field);
    }
  });
});

describe('what a candidate may see about themselves', () => {
  const view = toSelfCandidateView(candidateRow, candidateRelations);

  it('adds their own contact details and their own figures', () => {
    expectExactly(
      view,
      [
        ...CANDIDATE_COMMON,
        'mobile',
        'linkedinUrl',
        ...CANDIDATE_MONEY_FIELDS,
        'profileStatus',
        'submittedAt',
        'reviewedAt',
        'reviewNote',
        'completionPercent',
        'consentedAt',
        'updatedAt',
      ],
      'toSelfView(candidate)',
    );
  });
});

describe('what an admin may see about a candidate', () => {
  const view = toAdminCandidateView(candidateRow, candidateRelations, {
    email: 'test@example.com',
    userStatus: 'ACTIVE',
  });

  it('is the only view with every contact route and every figure', () => {
    for (const field of ['email', 'mobile', 'linkedinUrl', ...CANDIDATE_MONEY_FIELDS]) {
      expect(Object.keys(view), `admin view is missing ${field}`).toContain(field);
    }
  });
});

// --- Jobs: the salary band runs the other way -----------------------------

const JOB_COMMON = [
  'id',
  'title',
  'department',
  'numberOfPositions',
  'sectorSlug',
  'sectorName',
  'functionSlug',
  'functionName',
  'citySlug',
  'cityName',
  'additionalLocations',
  'state',
  'workType',
  'minExperience',
  'maxExperience',
  'educationRequirement',
  'description',
  'targetJoiningDate',
  'requiredSkills',
  'goodToHaveSkills',
  'publishedAt',
];

describe('what a candidate and the public may see about a job', () => {
  it('is anonymous and has no salary band — public view', () => {
    expectExactly(toPublicJobView(jobRow, jobRelations), JOB_COMMON, 'toPublicView(job)');
  });

  it('is anonymous and has no salary band — candidate view', () => {
    expectExactly(toCandidateJobView(jobRow, jobRelations), JOB_COMMON, 'toCandidateView(job)');
  });

  it('names no employer', () => {
    for (const view of [
      toPublicJobView(jobRow, jobRelations),
      toCandidateJobView(jobRow, jobRelations),
    ]) {
      expect(JSON.stringify(view)).not.toContain('ACME Industries');
      expect(Object.keys(view)).not.toContain('employerName');
      expect(Object.keys(view)).not.toContain('salaryBandMinLpa');
    }
  });
});

describe('what the owning employer and the admin may see about a job', () => {
  it('includes the band for the owner', () => {
    const view = toEmployerOwnerView(jobRow, jobRelations);
    expect(Object.keys(view)).toContain('salaryBandMinLpa');
    expect(Object.keys(view)).toContain('employerName');
  });

  it('adds review state for the admin, and nothing the owner lacks', () => {
    const owner = keysOf(toEmployerOwnerView(jobRow, jobRelations));
    const admin = keysOf(toAdminJobView(jobRow, jobRelations));
    expect(owner.every((k) => admin.includes(k))).toBe(true);
    expect(admin.filter((k) => !owner.includes(k)).sort()).toEqual([
      'contactFlags',
      'employerProfileId',
      'reviewedById',
    ]);
  });
});
