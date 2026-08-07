/**
 * Candidate job browsing and applications.
 *
 * BROWSING is gated on approval — the portal's central rule is that a candidate
 * sees no job listings until an admin approves their profile.
 *
 * TRACKING deliberately is not. D2 says a material edit "pauses job browsing";
 * it says nothing about hiding applications already in flight, and "track every
 * application's status" is a headline Phase 1 deliverable. Hiding the tracker
 * whenever a profile re-enters review would blank the screen on a candidate
 * mid-process. Each tracker route scopes to the caller's own profile id, so the
 * approval check adds nothing to security here.
 */

import { Router } from 'express';
import { z } from 'zod';
import { LIMITS } from '@bktc/shared';
import * as service from '../application/application.service.js';
import * as applicationRepo from '../../repositories/application.repo.js';
import * as candidateRepo from '../../repositories/candidate.repo.js';
import * as interviewRepo from '../../repositories/interview.repo.js';
import { toPartyView } from '../../serializers/interview.serializer.js';
import * as jobRepo from '../../repositories/job.repo.js';
import * as employerRepo from '../../repositories/employer.repo.js';
import * as taxonomyRepo from '../../repositories/taxonomy.repo.js';
import { loadJobRelations } from '../employer/employer.service.js';
import { toCandidateView as toCandidateJobView } from '../../serializers/job.serializer.js';
import {
  toCandidateView as toCandidateApplicationView,
  toCandidateStageEventView,
} from '../../serializers/application.serializer.js';
import { toCandidateView as toCandidateEmployerView } from '../../serializers/employer.serializer.js';
import { sendSerialized, sendCreated, buildPage } from '../../lib/respond.js';
import { requireAuth, requireRole, currentUser } from '../../middleware/auth.js';
import { badRequest, notFound, forbidden } from '../../lib/errors.js';

export const candidateJobsRouter = Router();

candidateJobsRouter.use(requireAuth, requireRole('CANDIDATE'));

const browseSchema = z.object({
  sector: z.string().max(80).optional(),
  function: z.string().max(80).optional(),
  city: z.string().max(80).optional(),
  minExperience: z.coerce.number().min(0).max(60).optional(),
  search: z.string().max(100).optional(),
  sort: z.string().max(20).optional(),
  dir: z.string().max(4).optional(),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(LIMITS.pagination.maxPageSize)
    .default(LIMITS.pagination.defaultPageSize),
});

/** Stages at which the employer's identity is revealed to the candidate. */
const IDENTITY_REVEALED_FROM = [
  'SHORTLISTED',
  'INTERVIEW_SCHEDULED',
  'INTERVIEWED',
  'OFFER_MADE',
  'OFFER_ACCEPTED',
  'OFFER_DECLINED',
  'JOINED',
];

candidateJobsRouter.get('/jobs', (req, res) => {
  const auth = currentUser(req);
  const profile = service.requireApprovedCandidate(auth.id);
  const q = browseSchema.parse(req.query);

  if (q.sort !== undefined && !jobRepo.isBrowseSort(q.sort)) {
    throw badRequest(`Cannot sort by "${q.sort}".`);
  }
  if (q.dir !== undefined && !applicationRepo.isSortDirection(q.dir)) {
    throw badRequest('Sort direction must be ASC or DESC.');
  }

  const { rows, total } = jobRepo.browseLive({
    sectorSlug: q.sector,
    functionSlug: q.function,
    citySlug: q.city,
    minExperience: q.minExperience,
    search: q.search,
    sort: q.sort,
    dir: q.dir as never,
    limit: q.pageSize,
    offset: (q.page - 1) * q.pageSize,
  });

  // Which of these has this candidate already applied to — so the list can say
  // "Applied" rather than offering a button that will fail.
  const applied = new Set(
    rows
      .map((job) => applicationRepo.findByJobAndCandidate(job.id, profile.id))
      .filter((a) => a !== undefined && a.stage !== 'WITHDRAWN')
      .map((a) => a!.job_id),
  );

  const items = rows.map((row) => ({
    ...toCandidateJobView(row, loadJobRelations(row)),
    hasApplied: applied.has(row.id),
  }));

  sendSerialized(res, buildPage(items, q.page, q.pageSize, total));
});

candidateJobsRouter.get('/jobs/:id', (req, res) => {
  const auth = currentUser(req);
  const profile = service.requireApprovedCandidate(auth.id);

  const job = jobRepo.findLiveById(req.params.id ?? '');
  if (!job) throw notFound('That role is no longer available.');

  const application = applicationRepo.findByJobAndCandidate(job.id, profile.id);

  sendSerialized(res, {
    ...toCandidateJobView(job, loadJobRelations(job)),
    hasApplied: application !== undefined && application.stage !== 'WITHDRAWN',
    applicationId: application?.id ?? null,
  });
});

candidateJobsRouter.post('/jobs/:id/apply', (req, res) => {
  const auth = currentUser(req);
  const result = service.apply(auth.id, req.params.id ?? '');
  sendCreated(res, { applicationId: result.applicationId, reopened: result.reopened });
});

// --- Applications ---------------------------------------------------------

const pageSchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(LIMITS.pagination.maxPageSize).default(20),
});

candidateJobsRouter.get('/applications', (req, res) => {
  const auth = currentUser(req);
  // Own profile only — no approval gate. See the note at the top of this file.
  const profile = candidateRepo.findByUserId(auth.id);
  if (!profile) throw notFound('Profile not found.');
  const q = pageSchema.parse(req.query);

  const { rows, total } = applicationRepo.listForCandidate(
    profile.id,
    q.pageSize,
    (q.page - 1) * q.pageSize,
  );

  const items = rows.map(({ application, job, employerName }) =>
    toCandidateApplicationView(application, {
      jobTitle: job.title,
      cityName: taxonomyRepo.nameById('city', job.city_id),
      sectorName: taxonomyRepo.nameById('sector', job.sector_id),
      // Anonymous until shortlist.
      employerName: IDENTITY_REVEALED_FROM.includes(application.stage) ? employerName : null,
      timeline: applicationRepo.listStageEvents(application.id).map(toCandidateStageEventView),
    }),
  );

  sendSerialized(res, buildPage(items, q.page, q.pageSize, total));
});

candidateJobsRouter.post('/applications/:id/withdraw', (req, res) => {
  const auth = currentUser(req);
  service.withdraw(auth.id, req.params.id ?? '');
  sendSerialized(res, { withdrawn: true });
});

/**
 * The interview for one of my applications, plus my confirmation.
 *
 * Both parties see identical details — a mismatch here means somebody turns up
 * at the wrong time or place, which is the client's business failing in front
 * of their own customer.
 */
candidateJobsRouter.get('/applications/:id/interview', (req, res) => {
  const auth = currentUser(req);
  const application = service.getOwnApplication(auth.id, req.params.id ?? '');

  const interview = interviewRepo.findScheduled(application.id);
  sendSerialized(res, { interview: interview ? toPartyView(interview, 'CANDIDATE') : null });
});

candidateJobsRouter.post('/applications/:id/interview/confirm', (req, res) => {
  const auth = currentUser(req);
  const application = service.getOwnApplication(auth.id, req.params.id ?? '');

  const interview = interviewRepo.findScheduled(application.id);
  if (!interview) throw notFound('There is no interview arranged for this application.');

  interviewRepo.confirm(interview.id, 'CANDIDATE');
  sendSerialized(res, { interview: toPartyView(interviewRepo.findById(interview.id)!, 'CANDIDATE') });
});

/**
 * "Not interested" on a role BK put them forward for.
 *
 * Recommendation shares a profile with a company the candidate did not choose,
 * so the ability to step back out is part of the consent, not a nicety.
 */
candidateJobsRouter.post('/applications/:id/decline-recommendation', (req, res) => {
  const auth = currentUser(req);
  const application = service.getOwnApplication(auth.id, req.params.id ?? '');

  if (application.is_recommended !== 1) {
    throw badRequest('You applied to this role yourself — withdraw it instead.');
  }

  service.withdraw(auth.id, application.id);
  sendSerialized(res, { withdrawn: true });
});

/**
 * The company behind a role, once the candidate has earned the reveal.
 * Carries no HR contact details — all contact routes through the admin team.
 */
candidateJobsRouter.get('/applications/:id/company', (req, res) => {
  const auth = currentUser(req);
  const application = service.getOwnApplication(auth.id, req.params.id ?? '');

  if (!IDENTITY_REVEALED_FROM.includes(application.stage)) {
    throw forbidden('The company is revealed once you are shortlisted.');
  }

  const job = jobRepo.findById(application.job_id);
  if (!job) throw notFound('Role not found.');

  const employer = employerRepo.findById(job.employer_profile_id);
  if (!employer) throw notFound('Company not found.');

  sendSerialized(
    res,
    toCandidateEmployerView(employer, {
      sectorSlug: taxonomyRepo.slugById('sector', employer.sector_id),
      sectorName: taxonomyRepo.nameById('sector', employer.sector_id),
      locations: [],
    }),
  );
});
