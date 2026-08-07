/**
 * Authorised file download.
 *
 * Files live outside the web root and are only ever served through here, so
 * every request is authorised against the requester's role and relationship to
 * the file. Guessing an id gets a 403.
 *
 * Response hardening, because the bytes are user-supplied and served from the
 * same origin as the session cookie:
 *
 *   - Content-Disposition: attachment, always. A PDF with embedded JavaScript
 *     rendered inline would execute in the viewer's session context.
 *   - The filename is sanitised and RFC 5987 encoded; original_name is
 *     attacker-controlled and a newline in a header is header injection.
 *   - Content-Type comes from the verified magic bytes, never the client's
 *     claim, with nosniff so the browser does not second-guess it.
 *   - A restrictive CSP and sandbox on the response itself.
 *
 * Plan reference: HIGH-22.
 */

import { Router } from 'express';
import fs from 'node:fs';
import * as fileRepo from '../../repositories/file.repo.js';
import * as employerRepo from '../../repositories/employer.repo.js';
import * as applicationRepo from '../../repositories/application.repo.js';
import { requireAuth, currentUser } from '../../middleware/auth.js';
import { forbidden, notFound } from '../../lib/errors.js';
import * as storage from '../../lib/file-storage.js';

export const fileRouter = Router();

/** Strips anything that could break out of the header value. */
function safeFilename(original: string, fallbackExtension: string): string {
  const cleaned = original
    .replace(/[\r\n"\\]/g, '')
    .replace(/[^\w.\- ]/g, '_')
    .trim()
    .slice(0, 100);
  return cleaned.length > 0 ? cleaned : `resume${fallbackExtension}`;
}

fileRouter.get('/:id', requireAuth, (req, res) => {
  const auth = currentUser(req);
  const id = req.params.id ?? '';

  const file = fileRepo.findByIdIncludingSuperseded(id);
  // Same response whether the file is missing or simply not theirs — a 404 here
  // and a 403 there would confirm which ids exist.
  if (!file) throw notFound('File not found.');

  // Deny by default; each branch has to earn access.
  let permitted = false;

  if (file.owner_id === auth.id) {
    permitted = true;
  } else if (auth.role === 'ADMIN') {
    permitted = true;
  } else if (auth.role === 'EMPLOYER') {
    /**
     * D1: an employer may open the CV of an APPROVED candidate — but only one
     * who has an application to a job they own. Both halves matter. The
     * approval check alone would let any employer read any approved
     * candidate's CV; the ownership check alone would ignore the client's
     * decision that approval is the gate.
     */
    const employer = employerRepo.findByUserId(auth.id);
    permitted =
      employer !== undefined &&
      applicationRepo.employerMayViewCandidateFiles(employer.id, file.owner_id);
  }

  if (!permitted) throw forbidden('You do not have access to that file.');

  const absolute = storage.absolutePathOf(file.stored_path);
  if (!fs.existsSync(absolute)) throw notFound('File not found.');

  const extension = file.stored_path.slice(file.stored_path.lastIndexOf('.'));
  const filename = safeFilename(file.original_name, extension);

  res.setHeader('Content-Type', file.mime_type);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(file.original_name)}`,
  );
  res.sendFile(absolute);
});
