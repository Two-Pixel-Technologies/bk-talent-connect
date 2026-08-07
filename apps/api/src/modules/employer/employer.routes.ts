/**
 * Employer routes.
 */

import { Router } from 'express';
import { z } from 'zod';
import { updateEmployerProfileSchema, updateJobSchema, LIMITS } from '@bktc/shared';
import * as service from './employer.service.js';
import * as jobRepo from '../../repositories/job.repo.js';
import { toSelfView as toEmployerSelfView } from '../../serializers/employer.serializer.js';
import { toEmployerOwnerView } from '../../serializers/job.serializer.js';
import { sendSerialized, sendCreated, buildPage } from '../../lib/respond.js';
import { requireAuth, requireRole, currentUser } from '../../middleware/auth.js';
import { badRequest } from '../../lib/errors.js';

export const employerRouter = Router();

employerRouter.use(requireAuth, requireRole('EMPLOYER'));

// --- Company profile ------------------------------------------------------

employerRouter.get('/profile', (req, res) => {
  const auth = currentUser(req);
  const profile = service.getProfile(auth.id);
  sendSerialized(res, toEmployerSelfView(profile, service.loadEmployerRelations(profile)));
});

employerRouter.patch('/profile', (req, res) => {
  const auth = currentUser(req);
  const result = service.updateProfile(auth.id, updateEmployerProfileSchema.parse(req.body));
  const profile = service.getProfile(auth.id);
  sendSerialized(res, {
    profile: toEmployerSelfView(profile, service.loadEmployerRelations(profile)),
    requiresReapproval: result.requiresReapproval,
    materialChanges: result.materialChanges,
  });
});

// --- Jobs -----------------------------------------------------------------

const listQuerySchema = z.object({
  status: z.string().max(40).optional(),
  sort: z.string().max(20).optional(),
  dir: z.string().max(4).optional(),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(LIMITS.pagination.maxPageSize).default(LIMITS.pagination.defaultPageSize),
});

employerRouter.get('/jobs', (req, res) => {
  const auth = currentUser(req);
  const profile = service.getProfile(auth.id);
  const query = listQuerySchema.parse(req.query);

  // Sort keys are validated against an allowlist, never interpolated raw.
  // Anything unrecognised is a 400 rather than a silent fallback, so a typo in
  // the client surfaces immediately instead of quietly changing the ordering.
  if (query.sort !== undefined && !jobRepo.isJobSortKey(query.sort)) {
    throw badRequest(`Cannot sort by "${query.sort}".`);
  }
  if (query.dir !== undefined && !jobRepo.isSortDirection(query.dir)) {
    throw badRequest('Sort direction must be ASC or DESC.');
  }

  const { rows, total } = jobRepo.listForEmployer({
    employerProfileId: profile.id,
    status: query.status,
    sort: query.sort,
    dir: query.dir,
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  });

  const items = rows.map((row) => toEmployerOwnerView(row, service.loadJobRelations(row)));
  sendSerialized(res, {
    ...buildPage(items, query.page, query.pageSize, total),
    counts: jobRepo.countForEmployer(profile.id),
  });
});

const createJobSchema = z.object({
  title: z.string().trim().min(LIMITS.job.title.min).max(LIMITS.job.title.max),
});

employerRouter.post('/jobs', (req, res) => {
  const auth = currentUser(req);
  const { title } = createJobSchema.parse(req.body);
  const jobId = service.createJob(auth.id, title);
  const job = service.getOwnedJob(auth.id, jobId);
  sendCreated(res, toEmployerOwnerView(job, service.loadJobRelations(job)));
});

employerRouter.get('/jobs/:id', (req, res) => {
  const auth = currentUser(req);
  const job = service.getOwnedJob(auth.id, req.params.id ?? '');
  sendSerialized(res, toEmployerOwnerView(job, service.loadJobRelations(job)));
});

employerRouter.patch('/jobs/:id', (req, res) => {
  const auth = currentUser(req);
  const jobId = req.params.id ?? '';
  const result = service.updateJob(auth.id, jobId, updateJobSchema.parse(req.body));
  const job = service.getOwnedJob(auth.id, jobId);

  sendSerialized(res, {
    job: toEmployerOwnerView(job, service.loadJobRelations(job)),
    requiresReapproval: result.requiresReapproval,
    materialChanges: result.materialChanges,
    unpublished: result.unpublished,
  });
});

employerRouter.post('/jobs/:id/submit', (req, res) => {
  const auth = currentUser(req);
  const jobId = req.params.id ?? '';
  service.submitJob(auth.id, jobId);
  const job = service.getOwnedJob(auth.id, jobId);
  sendSerialized(res, toEmployerOwnerView(job, service.loadJobRelations(job)));
});

/** How many applicants a close would resolve — so the UI can warn first. */
employerRouter.get('/jobs/:id/close-impact', (req, res) => {
  const auth = currentUser(req);
  const job = service.getOwnedJob(auth.id, req.params.id ?? '');
  sendSerialized(res, { affectedApplicants: service.countCloseImpact(job.id) });
});

employerRouter.post('/jobs/:id/close', (req, res) => {
  const auth = currentUser(req);
  const jobId = req.params.id ?? '';
  const { closedApplications } = service.closeJob(auth.id, jobId);
  const job = service.getOwnedJob(auth.id, jobId);
  sendSerialized(res, {
    job: toEmployerOwnerView(job, service.loadJobRelations(job)),
    // Surfaced rather than discarded: the employer should be told how many
    // people that button just rejected.
    closedApplications,
  });
});

employerRouter.post('/jobs/:id/reopen', (req, res) => {
  const auth = currentUser(req);
  const jobId = req.params.id ?? '';
  const { restoredApplications } = service.reopenJob(auth.id, jobId);
  const job = service.getOwnedJob(auth.id, jobId);
  sendSerialized(res, {
    job: toEmployerOwnerView(job, service.loadJobRelations(job)),
    restoredApplications,
  });
});

// --- Company profile submission -------------------------------------------

employerRouter.post('/profile/submit', (req, res) => {
  const auth = currentUser(req);
  service.submitProfile(auth.id);
  const profile = service.getProfile(auth.id);
  sendSerialized(res, toEmployerSelfView(profile, service.loadEmployerRelations(profile)));
});
