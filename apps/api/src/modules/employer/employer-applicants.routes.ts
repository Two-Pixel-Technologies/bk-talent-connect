/**
 * The employer's applicant list and pipeline actions.
 *
 * This is the highest-risk surface in the product for privacy: it is where an
 * employer sees candidates. Every response goes through toEmployerView, which
 * carries no salary, email or mobile.
 */

import { Router } from 'express';
import { z } from 'zod';
import {
  APPLICATION_STAGES,
  LIMITS,
  OUTCOME_REASON_CODES,
  allowedNextStages,
  type ApplicationStage,
} from '@bktc/shared';
import * as applicationService from '../application/application.service.js';
import * as applicationRepo from '../../repositories/application.repo.js';
import * as candidateRepo from '../../repositories/candidate.repo.js';
import * as interviewRepo from '../../repositories/interview.repo.js';
import * as recommendationService from '../admin/recommendation.service.js';
import { toPartyView } from '../../serializers/interview.serializer.js';
import { getProfile, getOwnedJob, loadJobRelations } from './employer.service.js';
import { loadRelations as loadCandidateRelations } from '../candidate/candidate.service.js';
import { toEmployerView as toEmployerCandidateView } from '../../serializers/candidate.serializer.js';
import { toEmployerView as toEmployerApplicationView } from '../../serializers/application.serializer.js';
import { toEmployerOwnerView } from '../../serializers/job.serializer.js';
import { sendSerialized, buildPage } from '../../lib/respond.js';
import { requireAuth, requireRole, currentUser } from '../../middleware/auth.js';
import { badRequest, forbidden, notFound } from '../../lib/errors.js';

export const employerApplicantsRouter = Router();

employerApplicantsRouter.use(requireAuth, requireRole('EMPLOYER'));

/**
 * Stage changes an employer may make on their own. Interview scheduling is
 * deliberately absent: BK coordinates every interview, so an employer requests
 * one (P6) rather than booking it.
 */
const EMPLOYER_STAGES: readonly ApplicationStage[] = [
  'UNDER_REVIEW',
  'SHORTLISTED',
  'NOT_SELECTED',
  'OFFER_MADE',
];

const listSchema = z.object({
  stage: z.string().max(40).optional(),
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

employerApplicantsRouter.get('/jobs/:id/applications', (req, res) => {
  const auth = currentUser(req);
  const job = getOwnedJob(auth.id, req.params.id ?? '');
  const q = listSchema.parse(req.query);

  // The allowlist matters most here: ?sort=expectedSalaryMin would let an
  // employer order candidates by a figure the serializer exists to hide.
  if (q.sort !== undefined && !applicationRepo.isApplicantSort(q.sort)) {
    throw badRequest(`Cannot sort by "${q.sort}".`);
  }
  if (q.dir !== undefined && !applicationRepo.isSortDirection(q.dir)) {
    throw badRequest('Sort direction must be ASC or DESC.');
  }

  const { rows, total, counts } = applicationRepo.listApplicants({
    jobId: job.id,
    stage: q.stage,
    sort: q.sort,
    dir: q.dir as never,
    limit: q.pageSize,
    offset: (q.page - 1) * q.pageSize,
  });

  const items = rows.map(({ application, candidateAvailable }) => {
    const profile = candidateRepo.findById(application.candidate_profile_id)!;
    return toEmployerApplicationView(
      application,
      toEmployerCandidateView(profile, loadCandidateRelations(profile)),
      { resumeFileId: application.resume_file_id_at_apply, candidateAvailable },
    );
  });

  sendSerialized(res, {
    ...buildPage(items, q.page, q.pageSize, total),
    counts,
    job: toEmployerOwnerView(job, loadJobRelations(job)),
  });
});

function loadOwnedApplication(userId: string, applicationId: string) {
  const employer = getProfile(userId);
  if (!applicationRepo.employerOwnsApplication(applicationId, employer.id)) {
    // Same answer whether it is someone else's or does not exist.
    throw forbidden('You do not have access to that application.');
  }
  const application = applicationRepo.findById(applicationId);
  if (!application) throw notFound('Application not found.');
  return application;
}

employerApplicantsRouter.get('/applications/:id', (req, res) => {
  const auth = currentUser(req);
  const application = loadOwnedApplication(auth.id, req.params.id ?? '');
  const profile = candidateRepo.findById(application.candidate_profile_id);
  if (!profile) throw notFound('Candidate not found.');

  // Viewing counts as engagement, for Phase 2's response-time metric.
  applicationRepo.markEmployerAction(application.id);

  sendSerialized(res, {
    ...toEmployerApplicationView(
      application,
      toEmployerCandidateView(profile, loadCandidateRelations(profile)),
      {
        resumeFileId: application.resume_file_id_at_apply,
        candidateAvailable: profile.profile_status === 'APPROVED',
      },
    ),
    // Driven by the shared transition matrix so the buttons and the server
    // cannot disagree about what is possible.
    availableStages: allowedNextStages(application.stage as ApplicationStage, 'EMPLOYER'),
  });
});

const stageSchema = z.object({
  // Validated against the real enum, so a garbage value is a 400 rather than
  // falling through to the interview-specific 403 message.
  stage: z.enum(APPLICATION_STAGES),
  note: z.string().trim().max(LIMITS.note.max).optional(),
  // Phase 2 aggregates this column; free text would make it unusable.
  outcomeReasonCode: z.enum(OUTCOME_REASON_CODES).optional(),
});

/** Stages an employer may not set, with the reason they cannot. */
const INTERVIEW_STAGES: readonly string[] = ['INTERVIEW_SCHEDULED', 'INTERVIEWED'];

employerApplicantsRouter.post('/applications/:id/stage', (req, res) => {
  const auth = currentUser(req);
  const application = loadOwnedApplication(auth.id, req.params.id ?? '');
  const input = stageSchema.parse(req.body);

  if (!EMPLOYER_STAGES.includes(input.stage)) {
    throw forbidden(
      INTERVIEW_STAGES.includes(input.stage)
        ? 'Interviews are arranged by the BK Talent Connect team. Shortlist the candidate and we will take it from there.'
        : 'That is not a change you can make. Our team handles this stage.',
    );
  }

  applicationService.changeStage({
    applicationId: application.id,
    toStage: input.stage,
    role: 'EMPLOYER',
    actorId: auth.id,
    note: input.note,
    outcomeReasonCode: input.outcomeReasonCode,
  });

  const updated = applicationRepo.findById(application.id)!;
  // Includes erased profiles: the application outlives the person by design,
  // and a non-null assertion here 500'd after the write had committed.
  const profile = candidateRepo.findByIdIncludingDeleted(updated.candidate_profile_id);
  if (!profile) throw notFound('That candidate’s record is no longer available.');

  sendSerialized(res, {
    ...toEmployerApplicationView(
      updated,
      toEmployerCandidateView(profile, loadCandidateRelations(profile)),
      {
        resumeFileId: updated.resume_file_id_at_apply,
        candidateAvailable: profile.profile_status === 'APPROVED',
      },
    ),
    availableStages: allowedNextStages(updated.stage as ApplicationStage, 'EMPLOYER'),
  });
});

// --- Interviews -----------------------------------------------------------

/**
 * The employer asking us to arrange a meeting.
 *
 * They cannot book it themselves — BK coordinates with both sides — but the
 * proposal's REVIEWING column promises they can ask, and before this their only
 * signal was to shortlist and hope somebody noticed.
 */
employerApplicantsRouter.post('/applications/:id/request-interview', (req, res) => {
  const auth = currentUser(req);
  const application = loadOwnedApplication(auth.id, req.params.id ?? '');

  const input = z
    .object({
      preferredSlots: z.array(z.string().max(120)).max(5).default([]),
      note: z.string().trim().max(LIMITS.note.max).optional(),
    })
    .parse(req.body);

  const requestId = recommendationService.requestInterview({
    applicationId: application.id,
    requestedById: auth.id,
    preferredSlots: input.preferredSlots,
    note: input.note,
  });

  sendSerialized(res, { requestId, status: 'OPEN' }, 201);
});

employerApplicantsRouter.get('/applications/:id/interview', (req, res) => {
  const auth = currentUser(req);
  const application = loadOwnedApplication(auth.id, req.params.id ?? '');

  const interview = interviewRepo.findScheduled(application.id);
  const openRequest = interviewRepo.findOpenRequest(application.id);

  sendSerialized(res, {
    interview: interview ? toPartyView(interview, 'EMPLOYER') : null,
    hasOpenRequest: openRequest !== undefined,
  });
});

employerApplicantsRouter.post('/applications/:id/interview/confirm', (req, res) => {
  const auth = currentUser(req);
  const application = loadOwnedApplication(auth.id, req.params.id ?? '');

  const interview = interviewRepo.findScheduled(application.id);
  if (!interview) throw notFound('There is no interview arranged for this application.');

  interviewRepo.confirm(interview.id, 'EMPLOYER');
  sendSerialized(res, { interview: toPartyView(interviewRepo.findById(interview.id)!, 'EMPLOYER') });
});
