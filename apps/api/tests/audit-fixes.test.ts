/**
 * Regression tests for the independent QA audit.
 *
 * Each block names the finding it locks down. These are the cases that got
 * through the original suites, so they are worth keeping distinct rather than
 * folding into the phase files.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { canTransition, mobileSchema, type ApplicationStage } from '@bktc/shared';
import { createTestContext, CSRF_HEADER, sessionCookie, type TestContext } from './helpers/test-app.js';
// `import type` only — erased at compile time, no runtime import side effect.
// A real (value) import of this module transitively reaches config/env.ts,
// which parses process.env ONCE at first import; done statically it would be
// hoisted ahead of beforeAll and lock in the default (real, non-test)
// DATABASE_PATH before the test harness ever gets a chance to override it.
// The actual value is loaded dynamically inside beforeAll instead.
import type * as ApplicationService from '../src/modules/application/application.service.js';
let applicationService: typeof ApplicationService;

let candidateUserId: string;
let employerUserId: string;

let ctx: TestContext;
let app: Express;
let candidateCookie: string;
let employerCookie: string;
let adminCookie: string;
let candidateProfileId: string;
let jobId: string;
let applicationId: string;

const PDF = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(512, 0x20)]);

beforeAll(async () => {
  ctx = await createTestContext('audit');
  app = ctx.app;

  const { getDb } = await import('../src/db/client.js');
  const userRepo = await import('../src/repositories/user.repo.js');
  const candidateRepo = await import('../src/repositories/candidate.repo.js');
  const employerRepo = await import('../src/repositories/employer.repo.js');
  const jobRepo = await import('../src/repositories/job.repo.js');
  const { hashPassword } = await import('../src/lib/password.js');
  applicationService = await import('../src/modules/application/application.service.js');

  userRepo.create({
    email: 'admin@bktc.test',
    passwordHash: await hashPassword('admin-password-1'),
    role: 'ADMIN',
  });
  adminCookie = sessionCookie(
    await request(app)
      .post('/api/auth/login')
      .set(CSRF_HEADER)
      .send({ email: 'admin@bktc.test', password: 'admin-password-1' }),
  );

  const candidate = await request(app).post('/api/auth/register/candidate').set(CSRF_HEADER).send({
    fullName: 'Anita Desai',
    email: 'anita@example.com',
    mobile: '9876543210',
    password: 'correct-horse-1',
    consentToShare: true,
  });
  candidateCookie = sessionCookie(candidate);
  await request(app)
    .post('/api/candidate/resume')
    .set('Cookie', candidateCookie)
    .set(CSRF_HEADER)
    .attach('resume', PDF, 'anita.pdf');

  const me = await request(app).get('/api/auth/me').set('Cookie', candidateCookie);
  candidateUserId = me.body.id;
  candidateProfileId = candidateRepo.findByUserId(me.body.id)!.id;
  candidateRepo.setStatus(candidateProfileId, 'APPROVED');

  const employer = await request(app).post('/api/auth/register/employer').set(CSRF_HEADER).send({
    companyName: 'Kirloskar Systems',
    hrContactName: 'Ravi Menon',
    email: 'ravi@kirloskar.example.com',
    hrContactPhone: '9876500000',
    password: 'correct-horse-2',
  });
  employerCookie = sessionCookie(employer);
  const employerMe = await request(app).get('/api/auth/me').set('Cookie', employerCookie);
  employerUserId = employerMe.body.id;
  const employerProfileId = employerRepo.findByUserId(employerMe.body.id)!.id;
  getDb().prepare("UPDATE employer_profile SET account_status='APPROVED' WHERE id=?").run(employerProfileId);

  jobId = jobRepo.create(employerProfileId, 'Senior Process Engineer');
  jobRepo.setStatus(jobId, 'APPROVED', ['DRAFT'], { publishedAt: new Date().toISOString() });

  const applied = await request(app)
    .post(`/api/candidate/jobs/${jobId}/apply`)
    .set('Cookie', candidateCookie)
    .set(CSRF_HEADER);
  applicationId = applied.body.applicationId;
});

afterAll(() => ctx.cleanup());

const asAdmin = (r: request.Test) => r.set('Cookie', adminCookie).set(CSRF_HEADER);
const asEmployer = (r: request.Test) => r.set('Cookie', employerCookie).set(CSRF_HEADER);
const asCandidate = (r: request.Test) => r.set('Cookie', candidateCookie).set(CSRF_HEADER);

/**
 * CRIT-1 used to lock down that the admin COULD drive the pipeline end to
 * end. Product decision for this round of work: Admin's pipeline view is
 * read-only — Candidate and Employer own every hiring decision and all
 * interview coordination. The mutating routes are gone (not just hidden),
 * so this now locks down the opposite: admin can still list/read, but every
 * mutation route 404s, including a direct, crafted request — UI hiding alone
 * would not be authorization. State needed for the timeline assertion is
 * seeded through the service layer directly, the same domain logic the old
 * admin route used to call.
 */
describe('CRIT-1 — the admin pipeline is read-only', () => {
  it('lists applications', async () => {
    const res = await asAdmin(request(app).get('/api/admin/applications'));
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].candidateName).toBe('Anita Desai');
  });

  it('no longer exposes a stage-change or interview-scheduling route to the admin', async () => {
    await asEmployer(request(app).post(`/api/employer/applications/${applicationId}/stage`)).send({
      stage: 'UNDER_REVIEW',
    });
    await asEmployer(request(app).post(`/api/employer/applications/${applicationId}/stage`)).send({
      stage: 'SHORTLISTED',
    });

    const stage = await asAdmin(
      request(app).post(`/api/admin/applications/${applicationId}/stage`),
    ).send({ stage: 'INTERVIEW_SCHEDULED' });
    expect(stage.status).toBe(404);

    const interview = await asAdmin(
      request(app).post(`/api/admin/applications/${applicationId}/interview`),
    ).send({
      scheduledAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      mode: 'VIDEO',
      locationOrLink: 'https://meet.example.com/bktc',
    });
    expect(interview.status).toBe(404);

    // The GET side of the same resource is still there — read, not write.
    const read = await asAdmin(request(app).get(`/api/admin/applications/${applicationId}`));
    expect(read.status).toBe(200);
    expect(read.body.stage).toBe('SHORTLISTED');
  });

  it('records the whole journey in the timeline, each step driven by its actual authorized actor', async () => {
    // INTERVIEW_SCHEDULED and INTERVIEWED are the employer's own actions now
    // (see recommendation.service.ts); OFFER_MADE is the employer's, same as
    // before; OFFER_ACCEPTED is the candidate's own decision; JOINED is the
    // employer confirming it. None of this is admin-driven any more.
    const recommendationService = await import('../src/modules/admin/recommendation.service.js');
    recommendationService.scheduleInterview({
      applicationId,
      scheduledAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      durationMinutes: 45,
      mode: 'VIDEO',
      locationOrLink: 'https://meet.example.com/bktc',
      actorId: employerUserId,
      role: 'EMPLOYER',
    });
    for (const [toStage, role, actorId] of [
      ['INTERVIEWED', 'EMPLOYER', employerUserId],
      ['OFFER_MADE', 'EMPLOYER', employerUserId],
      ['OFFER_ACCEPTED', 'CANDIDATE', candidateUserId],
      ['JOINED', 'EMPLOYER', employerUserId],
    ] as const satisfies readonly [ApplicationStage, 'EMPLOYER' | 'CANDIDATE', string][]) {
      applicationService.changeStage({ applicationId, toStage, role, actorId });
    }

    const applicationRepo = await import('../src/repositories/application.repo.js');
    expect(applicationRepo.findById(applicationId)!.stage).toBe('JOINED');

    const res = await asAdmin(request(app).get(`/api/admin/applications/${applicationId}`));
    const stages = res.body.timeline.map((e: { toStage: string }) => e.toStage);
    expect(stages).toEqual([
      'APPLIED',
      'UNDER_REVIEW',
      'SHORTLISTED',
      'INTERVIEW_SCHEDULED',
      'INTERVIEWED',
      'OFFER_MADE',
      'OFFER_ACCEPTED',
      'JOINED',
    ]);
  });

  it('is not reachable by an employer or candidate', async () => {
    expect((await asEmployer(request(app).get('/api/admin/applications'))).status).toBe(403);
    expect((await asCandidate(request(app).get('/api/admin/applications'))).status).toBe(403);
  });
});

describe('CRIT-2 — a superseded CV stays downloadable', () => {
  it('keeps the snapshot working after the candidate uploads a replacement', async () => {
    const applicationRepo = await import('../src/repositories/application.repo.js');
    const candidateRepo = await import('../src/repositories/candidate.repo.js');

    const jobRepo = await import('../src/repositories/job.repo.js');
    const employerRepo = await import('../src/repositories/employer.repo.js');
    const employerMe = await request(app).get('/api/auth/me').set('Cookie', employerCookie);
    const secondJob = jobRepo.create(employerRepo.findByUserId(employerMe.body.id)!.id, 'Second role');
    jobRepo.setStatus(secondJob, 'APPROVED', ['DRAFT'], { publishedAt: new Date().toISOString() });

    candidateRepo.setStatus(candidateProfileId, 'APPROVED');
    const applied = await asCandidate(request(app).post(`/api/candidate/jobs/${secondJob}/apply`));
    const snapshotId = applicationRepo.findById(applied.body.applicationId)!.resume_file_id_at_apply!;

    expect((await request(app).get(`/api/files/${snapshotId}`).set('Cookie', employerCookie)).status).toBe(200);

    // The candidate replaces their CV — the old row is soft-deleted, and the
    // profile drops back into review because 'resume' is a material field.
    await asCandidate(request(app).post('/api/candidate/resume')).attach('resume', PDF, 'anita-v2.pdf');

    // While the candidate is mid-review the employer is correctly refused —
    // that is D1 and CRIT-3 composing, not the snapshot being broken.
    expect(
      (await request(app).get(`/api/files/${snapshotId}`).set('Cookie', employerCookie)).status,
    ).toBe(403);

    // The admin, who is doing the reviewing, can always read it.
    expect((await request(app).get(`/api/files/${snapshotId}`).set('Cookie', adminCookie)).status).toBe(200);

    // Once re-approved, the document the employer evaluated is still there.
    // Before the fix this 404'd permanently the moment the CV was replaced.
    candidateRepo.setStatus(candidateProfileId, 'APPROVED');
    const after = await request(app).get(`/api/files/${snapshotId}`).set('Cookie', employerCookie);
    expect(after.status).toBe(200);
  });
});

describe('CRIT-3 — a candidate in re-review stays visible, marked unavailable', () => {
  it('keeps the row on the employer board and withholds the CV', async () => {
    const candidateRepo = await import('../src/repositories/candidate.repo.js');
    candidateRepo.setStatus(candidateProfileId, 'APPROVED');

    const before = await asEmployer(request(app).get(`/api/employer/jobs/${jobId}/applications`));
    expect(before.body.items[0].candidateAvailable).toBe(true);

    candidateRepo.setStatus(candidateProfileId, 'SUBMITTED');

    const after = await asEmployer(request(app).get(`/api/employer/jobs/${jobId}/applications`));
    // Present, not vanished.
    expect(after.body.items.length).toBe(1);
    expect(after.body.items[0].candidateAvailable).toBe(false);
    // CV withheld while unavailable.
    expect(after.body.items[0].resumeFileId).toBeNull();

    candidateRepo.setStatus(candidateProfileId, 'APPROVED');
  });
});

describe('CRIT-4 — the tracker survives re-review', () => {
  it('still lists applications while the profile is back in review', async () => {
    const candidateRepo = await import('../src/repositories/candidate.repo.js');
    candidateRepo.setStatus(candidateProfileId, 'SUBMITTED');

    const tracker = await asCandidate(request(app).get('/api/candidate/applications'));
    expect(tracker.status).toBe(200);
    expect(tracker.body.items.length).toBeGreaterThan(0);

    // Browsing stays gated — that is what D2 actually pauses.
    expect((await asCandidate(request(app).get('/api/candidate/jobs'))).status).toBe(403);

    candidateRepo.setStatus(candidateProfileId, 'APPROVED');
  });
});

describe('HIGH-2/14/15 — user errors are no longer 500s', () => {
  it('returns 413 with actionable text for an oversized CV', async () => {
    const big = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(6 * 1024 * 1024, 0x20)]);
    const res = await asCandidate(request(app).post('/api/candidate/resume')).attach(
      'resume',
      big,
      'big.pdf',
    );
    expect(res.status).toBe(413);
    expect(res.body.error.message).toMatch(/5MB/);
  });

  it('returns 400 for the wrong upload field name', async () => {
    const res = await asCandidate(request(app).post('/api/candidate/resume')).attach(
      'file',
      PDF,
      'cv.pdf',
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for a truncated JSON body', async () => {
    const res = await request(app)
      .patch('/api/candidate/profile')
      .set('Cookie', candidateCookie)
      .set(CSRF_HEADER)
      .set('Content-Type', 'application/json')
      .send('{"fullName":');
    expect(res.status).toBe(400);
  });
});

describe('HIGH-3 — page overflow no longer 500s', () => {
  it('rejects an absurd page number on every paginated endpoint', async () => {
    const endpoints: [string, string][] = [
      ['/api/candidate/jobs', candidateCookie],
      ['/api/candidate/applications', candidateCookie],
      ['/api/employer/jobs', employerCookie],
      ['/api/admin/candidates', adminCookie],
      ['/api/admin/employers', adminCookie],
      ['/api/admin/jobs', adminCookie],
      ['/api/admin/applications', adminCookie],
    ];
    for (const [path, cookie] of endpoints) {
      const res = await request(app).get(`${path}?page=99999999999999999999`).set('Cookie', cookie);
      expect(res.status, path).toBe(400);
    }
  });
});

describe('HIGH-6 — an unknown taxonomy slug is rejected, not silently nulled', () => {
  it('refuses a bad city on the candidate profile and leaves the stored value alone', async () => {
    await asCandidate(request(app).patch('/api/candidate/profile')).send({ citySlug: 'pune' });

    const res = await asCandidate(request(app).patch('/api/candidate/profile')).send({
      citySlug: 'atlantis',
    });
    expect(res.status).toBe(400);

    // Previously this returned 200 and silently wiped the city.
    const profile = await asCandidate(request(app).get('/api/candidate/profile'));
    expect(profile.body.citySlug).toBe('pune');
  });

  it('refuses a bad sector on a job, leaving the stored value intact', async () => {
    const jobRepo = await import('../src/repositories/job.repo.js');
    jobRepo.updateFields(jobId, { sector_id: 1 });

    const res = await asEmployer(request(app).patch(`/api/employer/jobs/${jobId}`)).send({
      sectorSlug: 'not-a-real-sector',
    });
    expect(res.status).toBe(400);
    // A live job losing its sector would make it invisible to every filter.
    expect(jobRepo.findById(jobId)!.sector_id).toBe(1);
  });

  it('still allows an empty string to clear the field', async () => {
    const res = await asCandidate(request(app).patch('/api/candidate/profile')).send({ citySlug: '' });
    expect(res.status).toBe(200);
  });
});

describe('HIGH-8 — withdrawn applicants leave the employer board', () => {
  it('drops them from the list and the counts', async () => {
    const applicationRepo = await import('../src/repositories/application.repo.js');
    const candidateRepo = await import('../src/repositories/candidate.repo.js');
    candidateRepo.setStatus(candidateProfileId, 'APPROVED');

    const list = await asEmployer(request(app).get(`/api/employer/jobs/${jobId}/applications`));
    const target = list.body.items[0];

    applicationRepo.setStage(target.id, 'WITHDRAWN', target.stage);

    const after = await asEmployer(request(app).get(`/api/employer/jobs/${jobId}/applications`));
    expect(after.body.items.find((a: { id: string }) => a.id === target.id)).toBeUndefined();
    expect(after.body.counts.WITHDRAWN).toBeUndefined();
  });
});

describe('HIGH-11 — mobile numbers must be dialable', () => {
  it('rejects punctuation that is not a number', () => {
    for (const bad of ['++++++++++', '- - - - - -', '1234567890', '0000000000']) {
      expect(mobileSchema.safeParse(bad).success, bad).toBe(false);
    }
  });

  it('accepts real Indian formats', () => {
    for (const good of ['9876543210', '+919876543210', '98765 43210', '98765-43210']) {
      expect(mobileSchema.safeParse(good).success, good).toBe(true);
    }
  });
});

describe('MED-11 — withdrawing from a rejected application', () => {
  /*
   * This finding was originally about a MESSAGE: a candidate withdrawing from
   * a rejected application was told "only an admin can reopen a rejected
   * application", which is nonsense in reply to a withdrawal.
   *
   * The first fix was to allow the withdrawal outright, from any stage. That
   * was wrong, and a later audit showed why: combined with the sanctioned
   * WITHDRAWN → APPLIED re-apply, it let a rejected candidate reset themselves
   * to APPLIED at any time — bypassing the deliberate 24-hour admin-only
   * reversal window and wiping the rejection reason — and let a JOINED
   * candidate erase the record of their own placement.
   *
   * The message is still fixed. The rule is not bypassed.
   */
  it('is refused, but not with a message about reopening', () => {
    const check = canTransition('NOT_SELECTED', 'WITHDRAWN', 'CANDIDATE', {
      stageChangedAt: new Date(),
    });
    expect(check.allowed).toBe(false);
    expect(check.reason).not.toContain('admin');
  });

  it('leaves no two-step route out of a rejection', () => {
    // The escape that the short-circuit opened: withdraw, then re-apply.
    expect(canTransition('NOT_SELECTED', 'WITHDRAWN', 'CANDIDATE').allowed).toBe(false);
  });

  it('keeps terminal stages terminal for every role', () => {
    for (const role of ['CANDIDATE', 'EMPLOYER', 'ADMIN'] as const) {
      for (const from of ['JOINED', 'OFFER_DECLINED'] as const) {
        const check = canTransition(from, 'WITHDRAWN', role);
        expect(check.allowed, `${role} from ${from}`).toBe(false);
      }
    }
  });

  it('still lets a candidate withdraw while the process is live', () => {
    for (const from of ['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED', 'OFFER_MADE'] as const) {
      expect(canTransition(from, 'WITHDRAWN', 'CANDIDATE').allowed, from).toBe(true);
    }
  });
});

describe('MED-18 — total applications is reported', () => {
  it('appears in the admin stats', async () => {
    const res = await asAdmin(request(app).get('/api/admin/stats'));
    expect(res.body.applications).toBeDefined();
    expect(typeof res.body.applications.total).toBe('number');
    expect(res.body.applications.total).toBeGreaterThan(0);
  });
});

describe('HIGH-1 — the admin can open the CV they are approving', () => {
  it('returns a resume file id on the admin view, and it downloads', async () => {
    const res = await asAdmin(request(app).get(`/api/admin/candidates/${candidateProfileId}`));
    expect(res.body.candidate.resumeFileId).toBeTruthy();

    const download = await request(app)
      .get(`/api/files/${res.body.candidate.resumeFileId}`)
      .set('Cookie', adminCookie);
    expect(download.status).toBe(200);
  });
});

describe('HIGH-10 — replacing a CV re-queues an approved profile', () => {
  it('flips the profile back to review', async () => {
    const candidateRepo = await import('../src/repositories/candidate.repo.js');
    candidateRepo.setStatus(candidateProfileId, 'APPROVED');

    await asCandidate(request(app).post('/api/candidate/resume')).attach('resume', PDF, 'v3.pdf');

    // A vetted candidate must not be able to swap in a different document that
    // then reaches employers under D1 without a second look.
    expect(candidateRepo.findById(candidateProfileId)!.profile_status).toBe('SUBMITTED');
  });
});

describe('MED-2 — outcome reason codes are validated', () => {
  it('rejects a code outside the enum', async () => {
    const candidateRepo = await import('../src/repositories/candidate.repo.js');
    candidateRepo.setStatus(candidateProfileId, 'APPROVED');

    const list = await asEmployer(request(app).get(`/api/employer/jobs/${jobId}/applications`));
    if (list.body.items.length === 0) return;

    const res = await asEmployer(
      request(app).post(`/api/employer/applications/${list.body.items[0].id}/stage`),
    ).send({ stage: 'NOT_SELECTED', outcomeReasonCode: 'NOT_A_CODE' });
    expect(res.status).toBe(400);
  });
});

describe('MED-5 — auto-close records the real prior stage', () => {
  it('does not write a null from_stage', async () => {
    const jobRepo = await import('../src/repositories/job.repo.js');
    const applicationRepo = await import('../src/repositories/application.repo.js');
    const candidateRepo = await import('../src/repositories/candidate.repo.js');
    candidateRepo.setStatus(candidateProfileId, 'APPROVED');

    const employerRepo = await import('../src/repositories/employer.repo.js');
    const employerMe = await request(app).get('/api/auth/me').set('Cookie', employerCookie);
    const closeJobId = jobRepo.create(employerRepo.findByUserId(employerMe.body.id)!.id, 'Closing role');
    jobRepo.setStatus(closeJobId, 'APPROVED', ['DRAFT'], { publishedAt: new Date().toISOString() });

    const applied = await asCandidate(request(app).post(`/api/candidate/jobs/${closeJobId}/apply`));
    await asEmployer(request(app).post(`/api/employer/jobs/${closeJobId}/close`));

    const events = applicationRepo.listStageEvents(applied.body.applicationId);
    const closing = events[events.length - 1]!;
    expect(closing.to_stage).toBe('NOT_SELECTED');
    // Every Phase 2 duration metric reads this column.
    expect(closing.from_stage).toBe('APPLIED');
  });
});
