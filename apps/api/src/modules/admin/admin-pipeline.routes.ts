/**
 * Admin pipeline visibility — read-only.
 *
 * Product decision: Candidate and Employer own hiring decisions and interview
 * coordination end to end; Admin inspects the pipeline but does not move an
 * application's stage, select/reject a candidate, or schedule anything. The
 * mutating `POST /applications/:id/stage` route that used to live here has
 * been removed, not merely hidden from the UI.
 *
 * Every interview step, both offer outcomes and JOINED have since been
 * reassigned to Employer/Candidate (see employer-applicants.routes.ts's
 * scheduleInterview/completeInterview and offer-decision routes, and
 * stages.ts) — those are no longer stuck. What remains genuinely unreachable
 * by anyone is the three admin-only regressions and the 24-hour NOT_SELECTED
 * reversal (see stages.ts's "Admin-only regressions" block and
 * canTransition's NOT_SELECTED handling): those were deliberately never
 * assigned to Employer or Candidate, and Admin's mutation routes are gone, so
 * they are a known, reported gap, not something resolved here by re-granting
 * Admin that authority. See the final report for the product decision this
 * still needs.
 */

import { Router } from 'express';
import { z } from 'zod';
import { LIMITS, OUTCOME_REASON_CODES } from '@bktc/shared';
import * as applicationRepo from '../../repositories/application.repo.js';
import * as candidateRepo from '../../repositories/candidate.repo.js';
import * as employerRepo from '../../repositories/employer.repo.js';
import * as jobRepo from '../../repositories/job.repo.js';
import { toAdminView, toStageEventView } from '../../serializers/application.serializer.js';
import { sendSerialized, sendNoContent, buildPage } from '../../lib/respond.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { badRequest, notFound } from '../../lib/errors.js';

export const adminPipelineRouter = Router();

adminPipelineRouter.use(requireAuth, requireRole('ADMIN'));

const listSchema = z.object({
  jobId: z.string().max(40).optional(),
  candidateId: z.string().max(40).optional(),
  search: z.string().max(100).optional(),
  stage: z.string().max(40).optional(),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(LIMITS.pagination.maxPageSize)
    .default(LIMITS.pagination.defaultPageSize),
});

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
    candidateId: q.candidateId,
    search: q.search,
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

  sendSerialized(res, present(application));
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
