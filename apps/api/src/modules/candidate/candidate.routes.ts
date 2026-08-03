/**
 * Candidate profile routes.
 */

import { Router } from 'express';
import multer from 'multer';
import { updateProfileSchema, LIMITS } from '@bktc/shared';
import * as service from './candidate.service.js';
import * as candidateRepo from '../../repositories/candidate.repo.js';
import * as fileRepo from '../../repositories/file.repo.js';
import * as taxonomyRepo from '../../repositories/taxonomy.repo.js';
import { transaction } from '../../repositories/tx.js';
import { toSelfView } from '../../serializers/candidate.serializer.js';
import { sendSerialized } from '../../lib/respond.js';
import { requireAuth, requireRole, currentUser } from '../../middleware/auth.js';
import { newId } from '../../lib/ids.js';
import * as storage from '../../lib/file-storage.js';
import { badRequest, tooLarge } from '../../lib/errors.js';

export const candidateRouter = Router();

candidateRouter.use(requireAuth, requireRole('CANDIDATE'));

// Buffered in memory: a 5MB cap on a 1GB droplet is fine, and it lets the magic
// bytes be checked before anything durable is written.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LIMITS.resume.maxBytes, files: 1 },
});

candidateRouter.get('/profile', (req, res) => {
  const auth = currentUser(req);
  const profile = service.getProfile(auth.id);
  sendSerialized(res, toSelfView(profile, service.loadRelations(profile)));
});

candidateRouter.patch('/profile', (req, res) => {
  const auth = currentUser(req);
  const input = updateProfileSchema.parse(req.body);
  const result = service.updateProfile(auth.id, input);

  const profile = service.getProfile(auth.id);
  sendSerialized(res, {
    profile: toSelfView(profile, service.loadRelations(profile)),
    // The client warns before saving, but the server is what decides.
    requiresReapproval: result.requiresReapproval,
    materialChanges: result.materialChanges,
  });
});

candidateRouter.post('/profile/submit', (req, res) => {
  const auth = currentUser(req);
  service.submitProfile(auth.id);
  const profile = service.getProfile(auth.id);
  sendSerialized(res, toSelfView(profile, service.loadRelations(profile)));
});

/**
 * Resume upload.
 *
 * The file is verified and staged to tmp/, the row is written, and only then is
 * it renamed into place — better-sqlite3 transactions cannot contain async
 * filesystem work, so this ordering is what prevents a row pointing at a
 * missing file, or a file with no row.
 */
candidateRouter.post('/resume', upload.single('resume'), (req, res) => {
  const auth = currentUser(req);
  const file = req.file;
  if (!file) throw badRequest('No file was uploaded.');
  if (file.size > LIMITS.resume.maxBytes) throw tooLarge();

  const profile = service.getProfile(auth.id);
  const fileId = newId();
  const staged = storage.stage(fileId, file.buffer);

  try {
    transaction(() => {
      fileRepo.create({
        id: fileId,
        ownerId: auth.id,
        kind: 'RESUME',
        originalName: file.originalname.slice(0, 200),
        storedPath: staged.storedName,
        mimeType: staged.type.mime,
        sizeBytes: staged.sizeBytes,
        checksum: staged.checksum,
      });
      candidateRepo.updateFields(profile.id, { resume_file_id: fileId });
    });
  } catch (error) {
    storage.discard(staged);
    throw error;
  }

  storage.commit(staged);

  // Replacing a CV supersedes the old row but leaves the previous file in place
  // — an employer may have evaluated it, and P5 snapshots which CV was current
  // at the time of each application.
  const previousId = profile.resume_file_id;
  if (previousId && previousId !== fileId) fileRepo.softDelete(previousId);

  service.updateProfile(auth.id, {});

  const fresh = service.getProfile(auth.id);
  sendSerialized(res, toSelfView(fresh, service.loadRelations(fresh)), 201);
});

/** Taxonomy for the wizard's dropdowns. Cheap, cacheable, no personal data. */
export const taxonomyRouter = Router();

taxonomyRouter.get('/taxonomy', (_req, res) => {
  const shape = (rows: { slug: string; name: string }[]) =>
    rows.map((r) => ({ slug: r.slug, name: r.name }));

  sendSerialized(res, {
    sectors: shape(taxonomyRepo.listActive('sector')),
    functions: shape(taxonomyRepo.listActive('functional_area')),
    cities: shape(taxonomyRepo.listActive('city')),
  });
});

taxonomyRouter.get('/skills', (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q : '';
  if (query.trim().length < 1) {
    sendSerialized(res, { skills: [] });
    return;
  }
  const skills = taxonomyRepo
    .searchApprovedSkills(query)
    .map((s) => ({ id: s.id, name: s.name }));
  sendSerialized(res, { skills });
});
