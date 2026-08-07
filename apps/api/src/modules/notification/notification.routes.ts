/**
 * The notification feed.
 *
 * One router for all three roles: a notification belongs to a user, and the
 * repository scopes every read and write to req.user.id. There is no route
 * here that takes a user id, so there is nothing to tamper with.
 */

import { Router } from 'express';
import { z } from 'zod';
import { LIMITS } from '@bktc/shared';
import * as notificationRepo from '../../repositories/notification.repo.js';
import { toNotificationView } from '../../serializers/notification.serializer.js';
import { sendSerialized, sendNoContent, buildPage } from '../../lib/respond.js';
import { requireAuth, currentUser } from '../../middleware/auth.js';
import { notFound } from '../../lib/errors.js';

export const notificationRouter = Router();

notificationRouter.use(requireAuth);

const listSchema = z.object({
  unreadOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(LIMITS.pagination.maxPageSize).default(20),
});

notificationRouter.get('/', (req, res) => {
  const auth = currentUser(req);
  const q = listSchema.parse(req.query);

  const { rows, total } = notificationRepo.listForUser({
    userId: auth.id,
    unreadOnly: q.unreadOnly,
    limit: q.pageSize,
    offset: (q.page - 1) * q.pageSize,
  });

  sendSerialized(res, buildPage(rows.map(toNotificationView), q.page, q.pageSize, total));
});

/**
 * The badge.
 *
 * Split from the feed because it runs on every portal page and the feed does
 * not: a count is one indexed COUNT(*) against a partial index, where the feed
 * reads and serialises rows nobody is looking at yet.
 */
notificationRouter.get('/unread-count', (req, res) => {
  const auth = currentUser(req);
  sendSerialized(res, { count: notificationRepo.countUnread(auth.id) });
});

notificationRouter.post('/:id/read', (req, res) => {
  const auth = currentUser(req);
  const id = req.params.id ?? '';

  if (!notificationRepo.markRead(id, auth.id)) {
    // Already read, or not theirs. Both are 404: telling someone their id was
    // valid but belonged to another user is an existence oracle, and marking
    // an already-read notification read is not an error worth a distinct code.
    const existing = notificationRepo.findById(id);
    if (!existing || existing.user_id !== auth.id) throw notFound('Notification not found.');
  }

  sendNoContent(res);
});

notificationRouter.post('/read-all', (req, res) => {
  const auth = currentUser(req);
  sendSerialized(res, { markedRead: notificationRepo.markAllRead(auth.id) });
});
