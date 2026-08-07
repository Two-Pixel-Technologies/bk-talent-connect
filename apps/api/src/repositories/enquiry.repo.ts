/**
 * Contact enquiries from the public site.
 *
 * The table and the stats counter shipped with P4; these are the routes that
 * let an admin actually read one. The public submission form arrives with P9.
 */

import { getDb } from '../db/client.js';
import type { ContactEnquiryRow, Row } from '../db/rows.js';
import { newId } from '../lib/ids.js';
import { nowIso } from '@bktc/shared';

export function list(options: {
  readonly handled?: boolean | undefined;
  readonly limit: number;
  readonly offset: number;
}): { rows: Row<ContactEnquiryRow>[]; total: number } {
  const where =
    options.handled === undefined
      ? ''
      : options.handled
        ? 'WHERE handled_at IS NOT NULL'
        : 'WHERE handled_at IS NULL';

  const total = (
    getDb().prepare(`SELECT count(*) AS n FROM contact_enquiry ${where}`).get() as { n: number }
  ).n;

  const rows = getDb()
    .prepare(
      `SELECT * FROM contact_enquiry ${where}
       ORDER BY CASE WHEN handled_at IS NULL THEN 0 ELSE 1 END, created_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(options.limit, options.offset) as Row<ContactEnquiryRow>[];

  return { rows, total };
}

export function setHandled(id: string, handledById: string | null): boolean {
  const result = getDb()
    .prepare('UPDATE contact_enquiry SET handled_at = ?, handled_by_id = ? WHERE id = ?')
    .run(handledById ? nowIso() : null, handledById, id);
  return result.changes === 1;
}

export interface CreateEnquiryInput {
  readonly name: string;
  readonly email: string;
  readonly phone?: string | undefined;
  readonly enquiryType: 'CANDIDATE' | 'EMPLOYER' | 'OTHER';
  readonly message: string;
}

/**
 * @public Staged for P9 alongside contactLimiter — see the note there. This is
 * the only write path into contact_enquiry, and the screen that reads it is
 * already live at /admin/enquiries.
 */
export function create(input: CreateEnquiryInput): string {
  const id = newId();
  getDb()
    .prepare(
      `INSERT INTO contact_enquiry (id, name, email, phone, enquiry_type, message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, input.name, input.email, input.phone ?? null, input.enquiryType, input.message, nowIso());
  return id;
}
