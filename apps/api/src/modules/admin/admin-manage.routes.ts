/**
 * Admin management of the shared taxonomies and the contact queue.
 *
 * These were promised but had no routes: skills auto-created themselves
 * unapproved with no way to approve or merge them, so autocomplete could never
 * grow past the seed list; sectors and functions were described as "editable by
 * an admin so BK can extend them without a deploy" and were not; and the
 * contact_enquiry table shipped with a stats counter but nothing that could
 * read a row.
 */

import { Router } from 'express';
import { z } from 'zod';
import { LIMITS, slugify } from '@bktc/shared';
import * as taxonomyRepo from '../../repositories/taxonomy.repo.js';
import * as enquiryRepo from '../../repositories/enquiry.repo.js';
import * as auditRepo from '../../repositories/audit.repo.js';
import { sendSerialized, sendCreated, sendNoContent, buildPage } from '../../lib/respond.js';
import { requireAuth, requireRole, currentUser } from '../../middleware/auth.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';

export const adminManageRouter = Router();

adminManageRouter.use(requireAuth, requireRole('ADMIN'));

const pageSchema = z.object({
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(LIMITS.pagination.maxPageSize)
    .default(LIMITS.pagination.defaultPageSize),
});

// --- Skills ---------------------------------------------------------------

adminManageRouter.get('/skills', (req, res) => {
  const q = pageSchema.extend({ approved: z.enum(['true', 'false']).optional() }).parse(req.query);

  const { rows, total } = taxonomyRepo.listSkillsForAdmin({
    approved: q.approved === undefined ? undefined : q.approved === 'true',
    search: q.search,
    limit: q.pageSize,
    offset: (q.page - 1) * q.pageSize,
  });

  const items = rows.map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    isApproved: s.is_approved === 1,
    candidateCount: (s as unknown as { _candidate_count: number })._candidate_count,
    jobCount: (s as unknown as { _job_count: number })._job_count,
  }));

  sendSerialized(res, buildPage(items, q.page, q.pageSize, total));
});

adminManageRouter.post('/skills/:id/approve', (req, res) => {
  const auth = currentUser(req);
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw badRequest('Invalid skill.');

  if (!taxonomyRepo.setSkillApproved(id, true)) throw notFound('That skill no longer exists.');
  auditRepo.record({
    actorId: auth.id,
    action: 'SKILL_APPROVE',
    entityType: 'SKILL',
    entityId: String(id),
    ipAddress: req.ip,
  });
  sendNoContent(res);
});

adminManageRouter.post('/skills/:id/reject', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw badRequest('Invalid skill.');
  if (!taxonomyRepo.setSkillApproved(id, false)) throw notFound('That skill no longer exists.');
  sendNoContent(res);
});

adminManageRouter.patch('/skills/:id', (req, res) => {
  const id = Number(req.params.id);
  const { name } = z.object({ name: z.string().trim().min(1).max(60) }).parse(req.body);
  if (!Number.isInteger(id)) throw badRequest('Invalid skill.');

  const outcome = taxonomyRepo.renameSkill(id, name);
  if (outcome === 'NOT_FOUND') throw notFound('That skill no longer exists.');
  if (outcome === 'SLUG_TAKEN') {
    // Used to be a bare 500 from the UNIQUE constraint on skill.slug.
    throw conflict(`“${name}” already exists. Merge the two instead of renaming.`);
  }
  sendNoContent(res);
});

/**
 * Folds one skill into another. This is what stops the taxonomy fragmenting —
 * Phase 2 scores skills for 35 of 100 points, so duplicates degrade matching
 * directly.
 */
adminManageRouter.post('/skills/merge', (req, res) => {
  const auth = currentUser(req);
  const { sourceId, targetId } = z
    .object({ sourceId: z.number().int(), targetId: z.number().int() })
    .parse(req.body);

  if (sourceId === targetId) throw badRequest('Pick two different skills.');

  /*
   * Both ends must exist. Neither was checked, so merging into a mistyped
   * target id returned 200 with `moved: 0` and silently DELETED the source
   * skill — a typo quietly removing a term from the shared taxonomy that
   * Phase 2 scores 35 of 100 points on.
   */
  if (!taxonomyRepo.skillExists(sourceId)) throw notFound('That skill no longer exists.');
  if (!taxonomyRepo.skillExists(targetId)) {
    throw notFound('The skill you are merging into no longer exists.');
  }

  const result = taxonomyRepo.mergeSkills(sourceId, targetId);
  auditRepo.record({
    actorId: auth.id,
    action: 'SKILL_MERGE',
    entityType: 'SKILL',
    entityId: String(targetId),
    metadata: { count: result.moved },
    ipAddress: req.ip,
  });
  sendSerialized(res, result);
});

// --- Sectors and functions ------------------------------------------------

const TAXONOMY_TABLES = { sectors: 'sector', functions: 'functional_area' } as const;
type TaxonomyKind = keyof typeof TAXONOMY_TABLES;

function tableFor(kind: string): (typeof TAXONOMY_TABLES)[TaxonomyKind] {
  const table = TAXONOMY_TABLES[kind as TaxonomyKind];
  if (!table) throw notFound('Unknown taxonomy.');
  return table;
}

adminManageRouter.get('/taxonomy/:kind', (req, res) => {
  const table = tableFor(req.params.kind ?? '');
  const rows = taxonomyRepo.listAll(table).map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    sortOrder: r.sort_order,
    isActive: r.is_active === 1,
  }));
  sendSerialized(res, { items: rows });
});

adminManageRouter.post('/taxonomy/:kind', (req, res) => {
  const auth = currentUser(req);
  const table = tableFor(req.params.kind ?? '');
  const { name } = z.object({ name: z.string().trim().min(2).max(120) }).parse(req.body);

  const slug = slugify(name);
  if (taxonomyRepo.findBySlug(table, slug)) throw badRequest('That already exists.');

  const id = taxonomyRepo.createTaxonomyEntry(table, slug, name);
  auditRepo.record({
    actorId: auth.id,
    action: 'TAXONOMY_CREATE',
    entityType: 'SKILL',
    entityId: `${table}:${id}`,
    ipAddress: req.ip,
  });
  sendCreated(res, { id, slug, name });
});

adminManageRouter.patch('/taxonomy/:kind/:id', (req, res) => {
  const table = tableFor(req.params.kind ?? '');
  const id = Number(req.params.id);
  const input = z
    .object({ name: z.string().trim().min(2).max(120).optional(), isActive: z.boolean().optional() })
    .parse(req.body);

  if (!Number.isInteger(id)) throw badRequest('Invalid entry.');
  // Deactivating rather than deleting: candidates and jobs already reference
  // these rows, and a hard delete would break the foreign key.
  if (!taxonomyRepo.updateTaxonomyEntry(table, id, input)) {
    throw notFound('That entry no longer exists.');
  }
  sendNoContent(res);
});

// --- Contact enquiries ----------------------------------------------------

adminManageRouter.get('/enquiries', (req, res) => {
  const q = pageSchema.extend({ handled: z.enum(['true', 'false']).optional() }).parse(req.query);

  const { rows, total } = enquiryRepo.list({
    handled: q.handled === undefined ? undefined : q.handled === 'true',
    limit: q.pageSize,
    offset: (q.page - 1) * q.pageSize,
  });

  const items = rows.map((e) => ({
    id: e.id,
    name: e.name,
    email: e.email,
    phone: e.phone,
    enquiryType: e.enquiry_type,
    message: e.message,
    handledAt: e.handled_at,
    createdAt: e.created_at,
  }));

  sendSerialized(res, buildPage(items, q.page, q.pageSize, total));
});

adminManageRouter.post('/enquiries/:id/handled', (req, res) => {
  const auth = currentUser(req);
  const { handled } = z.object({ handled: z.boolean().default(true) }).parse(req.body);
  if (!enquiryRepo.setHandled(req.params.id ?? '', handled ? auth.id : null)) {
    throw notFound('That enquiry no longer exists.');
  }
  sendNoContent(res);
});
