/**
 * Interview and note serializers.
 *
 * The candidate and employer views carry the same interview facts — both sides
 * must see identical details or the coordination is worse than useless. What
 * differs is that neither is given the other's contact route.
 *
 * Admin notes have NO candidate or employer view at all. They are internal, and
 * the safest way to guarantee that is for the serializer not to exist.
 */

import type { InterviewMode, InterviewStatus } from '@bktc/shared';
import type { InterviewRow, AdminNoteRow, Row } from '../db/rows.js';
import { unbrand } from '../db/rows.js';

/** Shared by both parties. Times are UTC ISO; the client renders them in IST. */
function baseView(row: Row<InterviewRow>) {
  const i = unbrand(row);
  return {
    id: i.id,
    scheduledAt: i.scheduled_at,
    durationMinutes: i.duration_minutes,
    mode: i.mode as InterviewMode,
    locationOrLink: i.location_or_link,
    instructions: i.instructions,
    status: i.status as InterviewStatus,
  };
}

export function toPartyView(row: Row<InterviewRow>, side: 'CANDIDATE' | 'EMPLOYER') {
  const i = unbrand(row);
  return {
    ...baseView(row),
    // Each side sees whether IT has confirmed, and whether the other side has —
    // that is the whole point of tracking both.
    youConfirmedAt: side === 'CANDIDATE' ? i.candidate_confirmed_at : i.employer_confirmed_at,
    otherPartyConfirmed:
      (side === 'CANDIDATE' ? i.employer_confirmed_at : i.candidate_confirmed_at) !== null,
  };
}

export function toAdminInterviewView(row: Row<InterviewRow>) {
  const i = unbrand(row);
  return {
    ...baseView(row),
    applicationId: i.application_id,
    candidateConfirmedAt: i.candidate_confirmed_at,
    employerConfirmedAt: i.employer_confirmed_at,
    supersededById: i.superseded_by_id,
    createdAt: i.created_at,
  };
}

export function toNoteView(row: Row<AdminNoteRow>, authorEmail: string) {
  const n = unbrand(row);
  return {
    id: n.id,
    body: n.body,
    authorEmail,
    authorId: n.author_id,
    createdAt: n.created_at,
  };
}
