/**
 * Admin pipeline control.
 *
 * This is the piece that makes the portal *managed* rather than a job board.
 * Twelve of the transitions in the D4 matrix are admin-only — every interview
 * step, both offer outcomes, JOINED, all three regressions, and the 24-hour
 * rejection reversal. Without these routes the validator carefully rejects
 * employers from those stages and then nobody can make them either, so every
 * application in the system stops dead at SHORTLISTED.
 *
 * OFFER_ACCEPTED and JOINED matter beyond the workflow: they are the only
 * source for Phase 2's offer-acceptance rate, which cannot be reconstructed
 * after the fact.
 */

import { Router } from 'express';
import { z } from 'zod';
import {
  allowedNextStages,
  APPLICATION_STAGES,
  LIMITS,
  OUTCOME_REASON_CODES,
  type ApplicationStage,
} from '@bktc/shared';
import * as applicationService from '../application/application.service.js';
import * as applicationRepo from '../../repositories/application.repo.js';
import * as candidateRepo from '../../repositories/candidate.repo.js';
import * as employerRepo from '../../repositories/employer.repo.js';
import * as jobRepo from '../../repositories/job.repo.js';
import * as auditRepo from '../../repositories/audit.repo.js';
import { toAdminView, toStageEventView } from '../../serializers/application.serializer.js';
import { sendSerialized, sendNoContent, buildPage } from '../../lib/respond.js';
import { requireAuth, requireRole, currentUser } from '../../middleware/auth.js';
import { badRequest, notFound } from '../../lib/errors.js';

export const adminPipelineRouter = Router();

adminPipelineRouter.use(requireAuth, requireRole('ADMIN'));

const listSchema = z.object({
  jobId: z.string().max(40).optional(),
  stage: z.string().max(40).optional(),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(LIMITS.pagination.maxPageSize)
    .default(LIMITS.pagination.defaultPageSize),
});

/**
 * Stages this endpoint offers.
 *
 * INTERVIEW_SCHEDULED is filtered out because it is not reachable here — see
 * the guard on the stage route. Offering a button that is guaranteed to 400 is
 * worse than not offering it.
 */
function stageActionsFor(stage: ApplicationStage): ApplicationStage[] {
  return allowedNextStages(stage, 'ADMIN').filter((s) => s !== 'INTERVIEW_SCHEDULED');
}

/** Assembles the admin view for one application, batching its lookups. */
function present(application: ReturnType<typeof applicationRepo.findById>) {
  if (!application) throw notFound('Application not found.');
  const profile = candidateRepo.findById(application.candidate_profile_id);
  const job = jobRepo.findById(application.job_id);
  const employer = job ? employerRepo.findById(job.employer_profile_id) : undefined;

  return toAdminView(application, {
    candidateName: profile?.full_name ?? '(deleted)',
    candidateProfileId: application.candidate_profile_id,
    jobTitle: job?.title ?? '(deleted)',
    employerName: employer?.company_name ?? '(deleted)',
    timeline: applicationRepo.listStageEvents(application.id).map(toStageEventView),
  });
}

adminPipelineRouter.get('/applications', (req, res) => {
  const q = listSchema.parse(req.query);
  const { rows, total } = applicationRepo.listForAdmin({
    jobId: q.jobId,
    stage: q.stage,
    limit: q.pageSize,
    offset: (q.page - 1) * q.pageSize,
  });

  sendSerialized(res, {
    ...buildPage(rows.map((row) => present(row)), q.page, q.pageSize, total),
    counts: applicationRepo.countByStage(q.jobId),
  });
});

adminPipelineRouter.get('/applications/:id', (req, res) => {
  const application = applicationRepo.findById(req.params.id ?? '');
  if (!application) throw notFound('Application not found.');

  sendSerialized(res, {
    ...present(application),
    // Straight from the shared matrix, so the admin's buttons and the
    // validator can never disagree about what is possible.
    availableStages: stageActionsFor(application.stage as ApplicationStage),
  });
});

const stageSchema = z.object({
  stage: z.enum(APPLICATION_STAGES),
  note: z.string().trim().max(LIMITS.note.max).optional(),
  outcomeReasonCode: z.enum(OUTCOME_REASON_CODES).optional(),
});

adminPipelineRouter.post('/applications/:id/stage', (req, res) => {
  const auth = currentUser(req);
  const applicationId = req.params.id ?? '';
  const input = stageSchema.parse(req.body);

  const before = applicationRepo.findById(applicationId);
  if (!before) throw notFound('Application not found.');

  /*
   * INTERVIEW_SCHEDULED is reachable only by actually scheduling one.
   *
   * The D4 matrix permits an admin to make this move, and taken literally that
   * allows an application to sit at "Interview arranged" with no interview
   * behind it — nothing to tell either party, nothing on the coordination
   * screen, and a candidate whose tracker says a meeting exists that does not.
   * The scheduling endpoint moves the stage itself, so this is the one
   * transition that must come with its facts attached.
   */
  if (input.stage === 'INTERVIEW_SCHEDULED') {
    throw badRequest(
      'Arrange the interview instead — pick a date, time and place, and the stage moves with it.',
    );
  }

  applicationService.changeStage({
    applicationId,
    toStage: input.stage,
    role: 'ADMIN',
    actorId: auth.id,
    note: input.note,
    outcomeReasonCode: input.outcomeReasonCode,
  });

  auditRepo.record({
    actorId: auth.id,
    action: `APPLICATION_STAGE_${input.stage}`,
    entityType: 'JOB',
    entityId: before.job_id,
    // Statuses only. Never the candidate's details.
    metadata: { fromStatus: before.stage, toStatus: input.stage },
    ipAddress: req.ip,
  });

  const after = applicationRepo.findById(applicationId);
  sendSerialized(res, {
    ...present(after),
    availableStages: stageActionsFor(after!.stage as ApplicationStage),
  });
});

/**
 * Records the outcome reason without moving the stage, so a rejection made by
 * an employer who skipped the reason can still be categorised. Phase 2 breaks
 * rejections down by reason and cannot recompute this later.
 */
adminPipelineRouter.post('/applications/:id/outcome-reason', (req, res) => {
  const schema = z.object({ outcomeReasonCode: z.enum(OUTCOME_REASON_CODES) });
  const { outcomeReasonCode } = schema.parse(req.body);

  const application = applicationRepo.findById(req.params.id ?? '');
  if (!application) throw notFound('Application not found.');
  if (!['NOT_SELECTED', 'OFFER_DECLINED', 'WITHDRAWN'].includes(application.stage)) {
    throw badRequest('An outcome reason only applies to a closed application.');
  }

  applicationRepo.setOutcomeReason(application.id, outcomeReasonCode);
  sendNoContent(res);
});
