/**
 * Data-protection routes.
 *
 * Split into two routers because the two audiences are different: anyone
 * signed in can ask to be erased and can see what we hold about them; only an
 * admin can carry an erasure out.
 */

import { Router } from 'express';
import { z } from 'zod';
import { LIMITS } from '@bktc/shared';
import * as service from './erasure.service.js';
import * as erasureRepo from '../../repositories/erasure.repo.js';
import * as userRepo from '../../repositories/user.repo.js';
import { sendSerialized, sendCreated, buildPage } from '../../lib/respond.js';
import { requireAuth, requireRole, currentUser } from '../../middleware/auth.js';
import { unbrand, type ErasureRequestRow, type Row } from '../../db/rows.js';

function toView(row: Row<ErasureRequestRow>) {
  const r = unbrand(row);
  return {
    id: r.id,
    status: r.status,
    reason: r.reason,
    decisionNote: r.decision_note,
    requestedAt: r.requested_at,
    handledAt: r.handled_at,
  };
}

// --- Any signed-in user ----------------------------------------------------

export const privacyRouter = Router();
privacyRouter.use(requireAuth);

privacyRouter.get('/erasure-requests', (req, res) => {
  const auth = currentUser(req);
  sendSerialized(res, { items: erasureRepo.listForUser(auth.id).map(toView) });
});

privacyRouter.post('/erasure-requests', (req, res) => {
  const auth = currentUser(req);
  const { reason } = z
    .object({ reason: z.string().trim().max(LIMITS.note.max).optional() })
    .parse(req.body);

  const id = service.requestErasure(auth.id, reason);
  sendCreated(res, toView(erasureRepo.findById(id)!));
});

// --- Admin -----------------------------------------------------------------

export const adminPrivacyRouter = Router();
adminPrivacyRouter.use(requireAuth, requireRole('ADMIN'));

adminPrivacyRouter.get('/erasure-requests', (req, res) => {
  const q = z
    .object({
      status: z.enum(['OPEN', 'COMPLETED', 'REJECTED']).optional(),
      page: z.coerce.number().int().min(1).max(100_000).default(1),
      pageSize: z.coerce.number().int().min(1).max(LIMITS.pagination.maxPageSize).default(20),
    })
    .parse(req.query);

  const { rows, total } = erasureRepo.list({
    status: q.status,
    limit: q.pageSize,
    offset: (q.page - 1) * q.pageSize,
  });

  const items = rows.map((row) => {
    // Deliberately includes erased accounts. A completed request whose subject
    // shows as "(unknown)" tells BK nothing about what they actioned; the
    // tombstone address at least identifies the record.
    const user = userRepo.findByIdIncludingDeleted(row.user_id);
    return {
      ...toView(row),
      userEmail: user?.email ?? '(unknown)',
      userRole: user?.role ?? '(unknown)',
    };
  });

  sendSerialized(res, buildPage(items, q.page, q.pageSize, total));
});

adminPrivacyRouter.post('/erasure-requests/:id/execute', (req, res) => {
  const auth = currentUser(req);
  const result = service.executeErasure(req.params.id ?? '', auth.id, req.ip);
  sendSerialized(res, result);
});

adminPrivacyRouter.post('/erasure-requests/:id/reject', (req, res) => {
  const auth = currentUser(req);
  const { note } = z.object({ note: z.string().max(LIMITS.note.max) }).parse(req.body);

  service.rejectErasure(req.params.id ?? '', auth.id, note);
  sendSerialized(res, { status: 'REJECTED' });
});
