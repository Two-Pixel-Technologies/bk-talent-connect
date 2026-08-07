/**
 * Admin routes.
 */

import { Router } from 'express';
import { z } from 'zod';
import { LIMITS } from '@bktc/shared';
import * as service from './admin.service.js';
import * as adminRepo from '../../repositories/admin.repo.js';
import * as auditRepo from '../../repositories/audit.repo.js';
import * as candidateRepo from '../../repositories/candidate.repo.js';
import * as employerRepo from '../../repositories/employer.repo.js';
import * as jobRepo from '../../repositories/job.repo.js';
import * as userRepo from '../../repositories/user.repo.js';
import { loadRelations as loadCandidateRelations } from '../candidate/candidate.service.js';
import { loadJobRelations, loadEmployerRelations } from '../employer/employer.service.js';
import { toAdminView as toAdminCandidateView } from '../../serializers/candidate.serializer.js';
import { toAdminView as toAdminEmployerView } from '../../serializers/employer.serializer.js';
import { toAdminView as toAdminJobView } from '../../serializers/job.serializer.js';
import { sendSerialized, sendNoContent, buildPage } from '../../lib/respond.js';
import { requireAuth, requireRole, currentUser } from '../../middleware/auth.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { handle } from '../../lib/handle.js';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole('ADMIN'));

const queueQuerySchema = z.object({
  status: z.string().max(40).optional(),
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

function checkSort(value: string | undefined, ok: (v: unknown) => boolean, dir: string | undefined): void {
  if (value !== undefined && !ok(value)) throw badRequest(`Cannot sort by "${value}".`);
  if (dir !== undefined && !adminRepo.isSortDirection(dir)) {
    throw badRequest('Sort direction must be ASC or DESC.');
  }
}

const reviewSchema = z.object({
  decision: z.enum(['APPROVE', 'REQUEST_CHANGES', 'REJECT']),
  note: z.string().trim().max(LIMITS.reviewNote.max).optional(),
  /**
   * Required, not optional. It is the optimistic-concurrency token: the status
   * the admin was looking at. Making it optional would let a direct API call
   * skip the guard, which is the whole point of having it.
   */
  expectedStatus: z.string().min(1, 'Missing the record status you are reviewing.').max(40),
});

// --- Stats ----------------------------------------------------------------

adminRouter.get('/stats', (_req, res) => {
  sendSerialized(res, adminRepo.stats());
});

// --- Candidate queue ------------------------------------------------------

adminRouter.get('/candidates', (req, res) => {
  const q = queueQuerySchema.parse(req.query);
  checkSort(q.sort, adminRepo.isCandidateSort, q.dir);

  const { rows, total } = adminRepo.listCandidates({
    status: q.status,
    search: q.search,
    sort: q.sort,
    dir: q.dir as never,
    limit: q.pageSize,
    offset: (q.page - 1) * q.pageSize,
  });

  const items = rows.map((row) =>
    toAdminCandidateView(row.profile, loadCandidateRelations(row.profile), {
      email: row.email,
      userStatus: row.userStatus,
    }),
  );
  sendSerialized(res, buildPage(items, q.page, q.pageSize, total));
});

adminRouter.get('/candidates/:id', (req, res) => {
  const profile = candidateRepo.findById(req.params.id ?? '');
  if (!profile) throw notFound('Candidate not found.');
  const user = userRepo.findById(profile.user_id);
  if (!user) throw notFound('Candidate not found.');

  sendSerialized(res, {
    candidate: toAdminCandidateView(profile, loadCandidateRelations(profile), {
      email: user.email,
      userStatus: user.status,
    }),
    userId: user.id,
    history: auditRepo.listForEntity('CANDIDATE', profile.id).map((row) => ({
      action: row.action,
      createdAt: row.created_at,
      metadata: row.metadata,
    })),
  });
});

adminRouter.post('/candidates/:id/review', (req, res) => {
  const auth = currentUser(req);
  const input = reviewSchema.parse(req.body);
  service.reviewCandidate(req.params.id ?? '', { ...input, actorId: auth.id, ipAddress: req.ip });
  sendNoContent(res);
});

// --- Employer queue -------------------------------------------------------

adminRouter.get('/employers', (req, res) => {
  const q = queueQuerySchema.parse(req.query);
  checkSort(q.sort, adminRepo.isEmployerSort, q.dir);

  const { rows, total } = adminRepo.listEmployers({
    status: q.status,
    search: q.search,
    sort: q.sort,
    dir: q.dir as never,
    limit: q.pageSize,
    offset: (q.page - 1) * q.pageSize,
  });

  const items = rows.map((row) =>
    toAdminEmployerView(row.profile, loadEmployerRelations(row.profile), {
      email: row.email,
      userStatus: row.userStatus,
      jobCount: row.jobCount,
    }),
  );
  sendSerialized(res, buildPage(items, q.page, q.pageSize, total));
});

adminRouter.get('/employers/:id', (req, res) => {
  const profile = employerRepo.findById(req.params.id ?? '');
  if (!profile) throw notFound('Company not found.');
  const user = userRepo.findById(profile.user_id);
  if (!user) throw notFound('Company not found.');

  sendSerialized(res, {
    employer: toAdminEmployerView(profile, loadEmployerRelations(profile), {
      email: user.email,
      userStatus: user.status,
      jobCount: Object.values(jobRepo.countForEmployer(profile.id)).reduce((a, b) => a + b, 0),
    }),
    userId: user.id,
  });
});

adminRouter.post('/employers/:id/review', (req, res) => {
  const auth = currentUser(req);
  const input = reviewSchema.parse(req.body);
  service.reviewEmployer(req.params.id ?? '', { ...input, actorId: auth.id, ipAddress: req.ip });
  sendNoContent(res);
});

// --- Job queue ------------------------------------------------------------

adminRouter.get('/jobs', (req, res) => {
  const q = queueQuerySchema.parse(req.query);
  checkSort(q.sort, adminRepo.isAdminJobSort, q.dir);

  const { rows, total } = adminRepo.listJobs({
    status: q.status,
    search: q.search,
    sort: q.sort,
    dir: q.dir as never,
    limit: q.pageSize,
    offset: (q.page - 1) * q.pageSize,
  });

  const items = rows.map((row) => toAdminJobView(row, loadJobRelations(row)));
  sendSerialized(res, buildPage(items, q.page, q.pageSize, total));
});

adminRouter.get('/jobs/:id', (req, res) => {
  const job = jobRepo.findById(req.params.id ?? '');
  if (!job) throw notFound('Job posting not found.');
  sendSerialized(res, toAdminJobView(job, loadJobRelations(job)));
});

adminRouter.post('/jobs/:id/review', (req, res) => {
  const auth = currentUser(req);
  const input = reviewSchema.parse(req.body);
  service.reviewJob(req.params.id ?? '', { ...input, actorId: auth.id, ipAddress: req.ip });
  sendNoContent(res);
});

/**
 * Candidate expectations against a job's band. Admin-only by construction —
 * the two figures sit behind different privacy boundaries and this is the only
 * place they meet.
 */
adminRouter.get('/salary-comparison', (req, res) => {
  const schema = z.object({ candidateId: z.string().min(1), jobId: z.string().min(1) });
  const { candidateId, jobId } = schema.parse(req.query);
  sendSerialized(res, service.compareSalary(candidateId, jobId));
});

// --- Users ----------------------------------------------------------------

adminRouter.post('/users/:id/suspend', (req, res) => {
  const auth = currentUser(req);
  service.suspendUser(req.params.id ?? '', auth.id, req.ip);
  sendNoContent(res);
});

/**
 * Hands the admin a temporary password to read out.
 *
 * Returned once, in the response body, and never stored in readable form. The
 * alternative in Phase 1 is an SSH session per forgotten password.
 */
adminRouter.post(
  '/users/:id/reset-password',
  handle(async (req, res) => {
  const auth = currentUser(req);
    const result = await service.resetUserPassword(req.params.id ?? '', auth.id, req.ip);
    sendSerialized(res, result);
  }),
);

adminRouter.post('/users/:id/reactivate', (req, res) => {
  const auth = currentUser(req);
  // Returns what was put back, so the admin can see that suspending and
  // reactivating actually round-trips rather than having to trust it.
  const result = service.reactivateUser(req.params.id ?? '', auth.id, req.ip);
  sendSerialized(res, result);
});
