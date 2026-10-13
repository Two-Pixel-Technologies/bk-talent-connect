/**
 * Employer profile and job posting use cases.
 */

import {
  findContactDetails,
  lpaToRupees,
  materialEmployerFieldsIn,
  materialJobFieldsIn,
  nowIso,
  submitEmployerProfileSchema,
  submitJobSchema,
  type UpdateEmployerProfileInput,
  type UpdateJobInput,
} from '@bktc/shared';
import { transaction } from '../../repositories/tx.js';
import * as employerRepo from '../../repositories/employer.repo.js';
import * as jobRepo from '../../repositories/job.repo.js';
import * as taxonomyRepo from '../../repositories/taxonomy.repo.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import {
  closeApplicationsForJob,
  restoreAutoClosedApplications,
} from '../application/application.service.js';
import * as applicationRepo from '../../repositories/application.repo.js';
import * as events from '../notification/notification-events.js';
import type { EmployerRelations } from '../../serializers/employer.serializer.js';
import { locationsOf } from '../../serializers/employer.serializer.js';
import type { JobRelations } from '../../serializers/job.serializer.js';
import type { EmployerProfileRow, JobRow, Row } from '../../db/rows.js';

export function getProfile(userId: string): Row<EmployerProfileRow> {
  const profile = employerRepo.findByUserId(userId);
  if (!profile) throw notFound('Company profile not found.');
  return profile;
}

export function loadEmployerRelations(profile: Row<EmployerProfileRow>): EmployerRelations {
  return {
    sectorSlug: taxonomyRepo.slugById('sector', profile.sector_id),
    sectorName: taxonomyRepo.nameById('sector', profile.sector_id),
    locations: locationsOf(profile),
  };
}

export interface UpdateEmployerResult {
  readonly requiresReapproval: boolean;
  readonly materialChanges: readonly string[];
}

/**
 * Same shape as D2/D3 for candidates and jobs: a verified company can correct
 * its phone number freely, but changing its NAME, sector or public
 * introduction goes back through review. The name is what a shortlisted
 * candidate is shown, so a verified account silently renaming itself to any
 * brand it likes would defeat the verification entirely.
 */
export function updateProfile(
  userId: string,
  input: UpdateEmployerProfileInput,
): UpdateEmployerResult {
  const profile = getProfile(userId);
  const patch: Record<string, unknown> = {};

  if (input.companyName !== undefined) patch.company_name = input.companyName;
  if (input.hrContactName !== undefined) patch.hr_contact_name = input.hrContactName;
  if (input.hrContactPhone !== undefined) patch.hr_contact_phone = input.hrContactPhone;
  if (input.companyIntro !== undefined) patch.company_intro = input.companyIntro;
  if (input.website !== undefined) patch.website = input.website === '' ? null : input.website;
  if (input.linkedinUrl !== undefined) patch.linkedin_url = input.linkedinUrl === '' ? null : input.linkedinUrl;
  if (input.sectorSlug !== undefined) patch.sector_id = taxonomyRepo.idBySlug('sector', input.sectorSlug);
  if (input.locations !== undefined) patch.locations = JSON.stringify(input.locations);

  const touched = Object.keys(input).filter(
    (key) => input[key as keyof UpdateEmployerProfileInput] !== undefined,
  );
  const material = materialEmployerFieldsIn(touched);
  const requiresReapproval = profile.account_status === 'APPROVED' && material.length > 0;

  transaction(() => {
    employerRepo.updateFields(profile.id, patch);
    if (requiresReapproval) {
      employerRepo.setStatus(profile.id, 'SUBMITTED');
    }
  });

  return { requiresReapproval, materialChanges: material };
}

/** Validates the company profile and puts it into the verification queue. */
export function submitProfile(userId: string): void {
  const profile = getProfile(userId);
  if (profile.account_status === 'APPROVED') {
    throw badRequest('Your company is already verified.');
  }

  const relations = loadEmployerRelations(profile);
  const result = submitEmployerProfileSchema.safeParse({
    companyName: profile.company_name,
    sectorSlug: relations.sectorSlug ?? '',
    locationCount: relations.locations.length,
    companyIntro: profile.company_intro ?? '',
    hrContactName: profile.hr_contact_name,
    hrContactPhone: profile.hr_contact_phone,
  });

  if (!result.success) {
    throw badRequest(
      'A few things are needed before we can verify your company.',
      result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    );
  }

  employerRepo.setStatus(profile.id, 'SUBMITTED');
}

/** Applicants a close would resolve, so the UI can warn before doing it. */
export function countCloseImpact(jobId: string): number {
  return applicationRepo.countOpenApplications(jobId);
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

/**
 * Every job route goes through here. It resolves the job AND proves the caller
 * owns it in one step, so no handler can accidentally skip the ownership check.
 *
 * A job belonging to another employer produces the same 403 as one that does
 * not exist — a 404 for one and 403 for the other would confirm which job ids
 * are real.
 */
export function getOwnedJob(userId: string, jobId: string): Row<JobRow> {
  const profile = getProfile(userId);
  const job = jobRepo.findById(jobId);
  if (!job || job.employer_profile_id !== profile.id) {
    throw forbidden('You do not have access to that job posting.');
  }
  return job;
}

export function loadJobRelations(job: Row<JobRow>): JobRelations {
  const skills = jobRepo.listSkills(job.id);
  const byId = new Map(
    taxonomyRepo.listSkillsByIds(skills.map((s) => s.skill_id)).map((s) => [s.id, s.name]),
  );
  const pick = (requirement: string) =>
    skills
      .filter((s) => s.requirement === requirement)
      .map((s) => ({ id: s.skill_id, name: byId.get(s.skill_id) ?? '' }))
      .filter((s) => s.name !== '');

  const employer = employerRepo.findById(job.employer_profile_id);

  return {
    requiredSkills: pick('REQUIRED'),
    goodToHaveSkills: pick('GOOD_TO_HAVE'),
    sectorSlug: taxonomyRepo.slugById('sector', job.sector_id),
    sectorName: taxonomyRepo.nameById('sector', job.sector_id),
    functionSlug: taxonomyRepo.slugById('functional_area', job.functional_area_id),
    functionName: taxonomyRepo.nameById('functional_area', job.functional_area_id),
    citySlug: taxonomyRepo.slugById('city', job.city_id),
    cityName: taxonomyRepo.nameById('city', job.city_id),
    additionalLocations: jobRepo.listAdditionalLocations(job.id).map((loc) => ({
      citySlug: taxonomyRepo.slugById('city', loc.city_id),
      cityName: taxonomyRepo.nameById('city', loc.city_id),
      state: loc.state,
    })),
    employerName: employer?.company_name ?? '',
    employerProfileId: job.employer_profile_id,
  };
}

/** Only a verified company may create a posting. */
export function createJob(userId: string, title: string): string {
  const profile = getProfile(userId);
  if (profile.account_status !== 'APPROVED') {
    throw forbidden('Your company is still being verified. You can post roles once that is done.');
  }
  return jobRepo.create(profile.id, title);
}

function toJobColumns(input: UpdateJobInput): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const set = (column: string, value: unknown) => {
    if (value !== undefined) patch[column] = value;
  };

  set('title', input.title);
  set('department', input.department);
  set('number_of_positions', input.numberOfPositions);
  set('state', input.state);
  set('work_type', input.workType);
  set('min_experience', input.minExperience);
  set('max_experience', input.maxExperience);
  set('education_requirement', input.educationRequirement);
  set('description', input.description);

  if (input.targetJoiningDate !== undefined) {
    patch.target_joining_date = input.targetJoiningDate === '' ? null : input.targetJoiningDate;
  }
  if (input.salaryBandMinLpa !== undefined) patch.salary_band_min = lpaToRupees(input.salaryBandMinLpa);
  if (input.salaryBandMaxLpa !== undefined) patch.salary_band_max = lpaToRupees(input.salaryBandMaxLpa);
  if (input.sectorSlug !== undefined) patch.sector_id = taxonomyRepo.idBySlug('sector', input.sectorSlug);
  if (input.functionSlug !== undefined)
    patch.functional_area_id = taxonomyRepo.idBySlug('functional_area', input.functionSlug);
  if (input.citySlug !== undefined) patch.city_id = taxonomyRepo.idBySlug('city', input.citySlug);

  return patch;
}

export interface UpdateJobResult {
  readonly requiresReapproval: boolean;
  readonly materialChanges: readonly string[];
  readonly unpublished: boolean;
}

/**
 * D3: on an APPROVED job, non-material edits (headcount, joining date,
 * good-to-have skills) apply live. Material edits — title, description, skills,
 * experience range, location, salary band — pull the posting out of public
 * listings and back into review.
 *
 * The description case is the one that matters most: allowing unreviewed edits
 * there is how an employer would put their own phone number in front of
 * candidates and bypass the portal entirely.
 */
export function updateJob(userId: string, jobId: string, input: UpdateJobInput): UpdateJobResult {
  const job = getOwnedJob(userId, jobId);

  if (job.status === 'CLOSED' || job.status === 'FILLED') {
    throw conflict('This posting is closed. Reopen it before editing.');
  }

  const touched = Object.keys(input).filter((key) => input[key as keyof UpdateJobInput] !== undefined);
  const material = materialJobFieldsIn(touched);
  const wasApproved = job.status === 'APPROVED';
  const requiresReapproval = wasApproved && material.length > 0;

  transaction(() => {
    const patch = toJobColumns(input);

    // Re-scan whenever the description changes, so a flag cleared by an admin
    // cannot survive a rewrite that reintroduces contact details.
    // Scans title and department too — both are free text shown on every
    // browse card, so a phone number there bypasses the rule just as well.
    if (
      input.description !== undefined ||
      input.title !== undefined ||
      input.department !== undefined
    ) {
      const scanned = [
        input.title ?? job.title,
        input.department ?? job.department ?? '',
        input.description ?? job.description ?? '',
      ].join('\n');
      const findings = findContactDetails(scanned);
      patch.contact_flags = findings.length > 0 ? JSON.stringify(findings) : null;
    }

    if (Object.keys(patch).length > 0) jobRepo.updateFields(job.id, patch);

    if (input.requiredSkills) {
      jobRepo.replaceSkills(
        job.id,
        'REQUIRED',
        input.requiredSkills.map((name) => taxonomyRepo.resolveSkillId(name)),
      );
    }
    if (input.goodToHaveSkills) {
      jobRepo.replaceSkills(
        job.id,
        'GOOD_TO_HAVE',
        input.goodToHaveSkills.map((name) => taxonomyRepo.resolveSkillId(name)),
      );
    }

    if (input.additionalLocations !== undefined) {
      // The primary location (unchanged, or the new value in this same
      // request) cannot also appear in the extra list — that would just be
      // the same place listed twice under a different name in the UI.
      const primaryCitySlug = input.citySlug ?? taxonomyRepo.slugById('city', job.city_id);
      const primaryState = input.state ?? job.state ?? '';
      const seen = new Set<string>();
      if (primaryCitySlug) seen.add(`${primaryCitySlug}|${primaryState}`);

      for (const loc of input.additionalLocations) {
        const key = `${loc.citySlug}|${loc.state}`;
        if (seen.has(key)) {
          throw badRequest('Each hiring location can only be added once.');
        }
        seen.add(key);
      }

      jobRepo.replaceAdditionalLocations(
        job.id,
        input.additionalLocations.map((loc) => ({
          cityId: taxonomyRepo.idBySlug('city', loc.citySlug) ?? null,
          state: loc.state,
        })),
      );
    }

    if (requiresReapproval) {
      // Leaves public listings until an admin approves it again.
      jobRepo.setStatus(job.id, 'PENDING_APPROVAL', ['APPROVED'], { publishedAt: null });
    }
  });

  return { requiresReapproval, materialChanges: material, unpublished: requiresReapproval };
}

/** Validates the whole posting and moves it into the admin review queue. */
export function submitJob(userId: string, jobId: string): void {
  const job = getOwnedJob(userId, jobId);

  if (job.status === 'PENDING_APPROVAL') throw badRequest('This posting is already under review.');
  if (job.status === 'APPROVED') throw badRequest('This posting is already live.');

  const relations = loadJobRelations(job);

  const result = submitJobSchema.safeParse({
    title: job.title,
    department: job.department ?? '',
    numberOfPositions: job.number_of_positions,
    sectorSlug: relations.sectorSlug ?? '',
    functionSlug: relations.functionSlug ?? '',
    citySlug: relations.citySlug ?? '',
    state: job.state ?? '',
    workType: job.work_type ?? undefined,
    requiredSkillCount: relations.requiredSkills.length,
    minExperience: job.min_experience ?? undefined,
    maxExperience: job.max_experience ?? undefined,
    educationRequirement: job.education_requirement ?? undefined,
    description: job.description ?? '',
    salaryBandMinLpa: job.salary_band_min == null ? undefined : job.salary_band_min / 100_000,
    salaryBandMaxLpa: job.salary_band_max == null ? undefined : job.salary_band_max / 100_000,
  });

  if (!result.success) {
    throw badRequest(
      'This posting is not ready to submit.',
      result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    );
  }

  const findings = findContactDetails(
    [job.title, job.department ?? '', job.description ?? ''].join('\n'),
  );
  const employer = getProfile(userId);

  const moved = transaction(() => {
    jobRepo.updateFields(job.id, {
      contact_flags: findings.length > 0 ? JSON.stringify(findings) : null,
    });
    const ok = jobRepo.setStatus(job.id, 'PENDING_APPROVAL', [
      'DRAFT',
      'CHANGES_REQUESTED',
      'REJECTED',
    ]);
    if (ok) {
      events.jobSubmitted({
        employerUserId: userId,
        jobId: job.id,
        jobTitle: job.title,
        companyName: employer.company_name,
      });
    }
    return ok;
  });

  if (!moved) throw conflict('This posting has already moved on. Refresh and try again.');
}

export function closeJob(userId: string, jobId: string): { closedApplications: number } {
  const job = getOwnedJob(userId, jobId);

  /*
   * One transaction, not two.
   *
   * The status change and the application cascade were separate commits, so a
   * failure between them left a closed posting with open applications against
   * it — candidates watching a tracker for a role that no longer exists, and
   * no way for anyone to notice.
   */
  return transaction(() => {
    const moved = jobRepo.setStatus(
      job.id,
      'CLOSED',
      ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED'],
      { closedAt: nowIso(), publishedAt: null },
    );
    if (!moved) throw conflict('This posting is already closed.');

    // Resolve the applications nobody has looked at yet. Anything already at
    // shortlist or beyond is a live conversation the BK team is running, so it
    // is left alone.
    const closedApplications = closeApplicationsForJob(job.id, userId, 'JOB_CLOSED');
    return { closedApplications };
  });
}

export function reopenJob(userId: string, jobId: string): { restoredApplications: number } {
  const job = getOwnedJob(userId, jobId);
  // Reopening always goes back through review — the role may have changed
  // since it was last approved.
  const moved = jobRepo.setStatus(job.id, 'DRAFT', ['CLOSED', 'FILLED'], { closedAt: null });
  if (!moved) throw conflict('This posting is not closed.');

  // Candidates auto-rejected by the close are restored. Without this, closing
  // and reopening left them permanently rejected with no way back — and until
  // the admin pipeline existed, nobody in the system could undo it.
  const restoredApplications = restoreAutoClosedApplications(job.id, userId);
  return { restoredApplications };
}
