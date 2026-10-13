/**
 * Admin recommendations, read-only interview visibility and private notes.
 *
 * Interview coordination — scheduling, rescheduling, cancelling, completing —
 * is deliberately NOT exposed here. Product decision: Candidate and Employer
 * own hiring coordination; Admin only observes. That leaves a real gap today
 * (SHORTLISTED -> INTERVIEW_SCHEDULED -> INTERVIEWED and the offer-acceptance
 * steps were admin-only transitions — see admin-pipeline.routes.ts's header
 * comment — and neither Employer nor Candidate has an equivalent booking
 * action), which is reported rather than patched over with admin authority.
 * `scheduleInterview`/`cancelInterview`/`completeInterview` in
 * recommendation.service.ts are kept (so interview DATA and the domain logic
 * around it are not destroyed) but are no longer reachable from any Admin route.
 */

import { Router } from 'express';
import { z } from 'zod';
import { LIMITS, NOTE_ENTITY_TYPES } from '@bktc/shared';
import * as service from './recommendation.service.js';
import * as applicationRepo from '../../repositories/application.repo.js';
import * as candidateRepo from '../../repositories/candidate.repo.js';
import * as interviewRepo from '../../repositories/interview.repo.js';
import * as taxonomyRepo from '../../repositories/taxonomy.repo.js';
import * as userRepo from '../../repositories/user.repo.js';
import { loadRelations as loadCandidateRelations } from '../candidate/candidate.service.js';
import { toAdminView as toAdminCandidateView } from '../../serializers/candidate.serializer.js';
import { toAdminInterviewView, toNoteView } from '../../serializers/interview.serializer.js';
import { sendSerialized, sendCreated, sendNoContent, buildPage } from '../../lib/respond.js';
import { requireAuth, requireRole, currentUser } from '../../middleware/auth.js';
import { badRequest, notFound } from '../../lib/errors.js';

export const adminCoordinationRouter = Router();

adminCoordinationRouter.use(requireAuth, requireRole('ADMIN'));

// --- Recommendations ------------------------------------------------------

const searchSchema = z.object({
  search: z.string().max(100).optional(),
  sector: z.string().max(80).optional(),
  minExperience: z.coerce.number().min(0).max(60).optional(),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(LIMITS.pagination.maxPageSize).default(20),
});

/**
 * Candidates who could be put forward for this role.
 *
 * Ranked by how many of the job's required skills they actually have — the
 * admin is doing by hand what Phase 2 will automate, so the ordering should
 * already be useful.
 */
adminCoordinationRouter.get('/jobs/:id/candidate-search', (req, res) => {
  const q = searchSchema.parse(req.query);
  const jobId = req.params.id ?? '';

  const { rows, total } = applicationRepo.searchRecommendable({
    jobId,
    search: q.search,
    sectorId: q.sector ? (taxonomyRepo.idBySlug('sector', q.sector) ?? undefined) : undefined,
    minExperience: q.minExperience,
    limit: q.pageSize,
    offset: (q.page - 1) * q.pageSize,
  });

  const items = rows.map(({ profileId, matchingSkills }) => {
    const profile = candidateRepo.findById(profileId)!;
    const user = userRepo.findById(profile.user_id)!;
    return {
      ...toAdminCandidateView(profile, loadCandidateRelations(profile), {
        email: user.email,
        userStatus: user.status,
      }),
      matchingSkills,
    };
  });

  sendSerialized(res, buildPage(items, q.page, q.pageSize, total));
});

adminCoordinationRouter.post('/jobs/:id/recommend', (req, res) => {
  const auth = currentUser(req);
  const { candidateProfileId } = z
    .object({ candidateProfileId: z.string().min(1) })
    .parse(req.body);

  const result = service.recommend(req.params.id ?? '', candidateProfileId, auth.id, req.ip);
  sendCreated(res, result);
});

// --- Interviews (read-only) ------------------------------------------------
//
// No POST/schedule, /cancel or /complete here — see the file-level comment.

adminCoordinationRouter.get('/applications/:id/interviews', (req, res) => {
  const rows = interviewRepo.listForApplication(req.params.id ?? '');
  sendSerialized(res, { items: rows.map(toAdminInterviewView) });
});

/** Everything BK needs to chase: upcoming interviews and unanswered requests. */
adminCoordinationRouter.get('/coordination', (_req, res) => {
  const upcoming = interviewRepo.listUpcoming().map((interview) => {
    const application = applicationRepo.findById(interview.application_id);
    const profile = application
      ? candidateRepo.findById(application.candidate_profile_id)
      : undefined;
    return {
      ...toAdminInterviewView(interview),
      candidateName: profile?.full_name ?? '(deleted)',
      applicationId: interview.application_id,
    };
  });

  const requests = interviewRepo.listOpenRequests().map((request) => {
    const application = applicationRepo.findById(request.application_id);
    const profile = application
      ? candidateRepo.findById(application.candidate_profile_id)
      : undefined;
    let preferredSlots: string[] = [];
    try {
      preferredSlots = request.preferred_slots
        ? (JSON.parse(request.preferred_slots) as string[])
        : [];
    } catch {
      preferredSlots = [];
    }
    return {
      id: request.id,
      applicationId: request.application_id,
      candidateName: profile?.full_name ?? '(deleted)',
      preferredSlots,
      note: request.note,
      createdAt: request.created_at,
    };
  });

  sendSerialized(res, { upcoming, requests });
});

// --- Private notes --------------------------------------------------------

adminCoordinationRouter.get('/notes', (req, res) => {
  const { entityType, entityId } = z
    .object({ entityType: z.enum(NOTE_ENTITY_TYPES), entityId: z.string().min(1) })
    .parse(req.query);

  const rows = interviewRepo.listNotes(entityType, entityId);
  const authors = new Map(
    rows.map((n) => [n.author_id, userRepo.findById(n.author_id)?.email ?? 'unknown']),
  );

  sendSerialized(res, {
    items: rows.map((n) => toNoteView(n, authors.get(n.author_id) ?? 'unknown')),
  });
});

adminCoordinationRouter.post('/notes', (req, res) => {
  const auth = currentUser(req);
  const input = z
    .object({
      entityType: z.enum(NOTE_ENTITY_TYPES),
      entityId: z.string().min(1),
      body: z.string().trim().min(1, 'Write something.').max(LIMITS.note.max),
    })
    .parse(req.body);

  const id = interviewRepo.createNote({ authorId: auth.id, ...input });
  const note = interviewRepo.listNotes(input.entityType, input.entityId).find((n) => n.id === id);
  if (!note) throw notFound('Note not found.');

  sendCreated(res, toNoteView(note, auth.email));
});

adminCoordinationRouter.delete('/notes/:id', (req, res) => {
  const auth = currentUser(req);
  // Authors delete their own notes; one admin does not erase another's record.
  if (!interviewRepo.deleteNote(req.params.id ?? '', auth.id)) {
    throw badRequest('You can only delete your own notes.');
  }
  sendNoContent(res);
});
