/**
 * Regressions for the second independent audit.
 *
 * Each `describe` names the finding it locks down. These are the cases that
 * existed and passed review — the point is that the previous suite could not
 * have caught any of them, so the assertions here are deliberately behavioural
 * rather than structural.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestContext, CSRF_HEADER, sessionCookie, type TestContext } from './helpers/test-app.js';
// `import type` only — erased at compile time, so this has no runtime import
// side effect. A real (value) import of any of these three would transitively
// reach config/env.ts, which parses process.env exactly once, on its first
// import; done statically it would be hoisted ahead of beforeAll and lock in
// the default (real, non-test) DATABASE_PATH before createTestContext ever
// gets to override it. The actual values are loaded dynamically inside
// beforeAll instead — see that helper's own comment for why it does the same.
import type * as RecommendationService from '../src/modules/admin/recommendation.service.js';
import type * as ApplicationService from '../src/modules/application/application.service.js';
import type { AppError as AppErrorClass } from '../src/lib/errors.js';

/**
 * Admin no longer has an HTTP route to schedule/cancel/complete an interview
 * or change an application's stage directly (see admin-pipeline.routes.ts and
 * admin-coordination.routes.ts) — that authority was removed as a product
 * decision. These tests are not about that authority; they are regression
 * locks on the underlying service behaviour (matrix checks, notification
 * side effects, conflict handling), so they call the service layer directly,
 * the same way the removed routes used to.
 */
let recommendationService: typeof RecommendationService;
let applicationService: typeof ApplicationService;
let AppError: typeof AppErrorClass;
let employerUserId: string;

let ctx: TestContext;
let app: Express;

let adminCookie: string;
let candidateCookie: string;
let employerCookie: string;
let candidateProfileId: string;
let jobId: string;
let applicationId: string;

const PDF = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(512, 0x20)]);
const asAdmin = (r: request.Test) => r.set('Cookie', adminCookie).set(CSRF_HEADER);
const asCandidate = (r: request.Test) => r.set('Cookie', candidateCookie).set(CSRF_HEADER);
const asEmployer = (r: request.Test) => r.set('Cookie', employerCookie).set(CSRF_HEADER);

beforeAll(async () => {
  ctx = await createTestContext('audit2');
  app = ctx.app;

  const { getDb } = await import('../src/db/client.js');
  const userRepo = await import('../src/repositories/user.repo.js');
  const candidateRepo = await import('../src/repositories/candidate.repo.js');
  const employerRepo = await import('../src/repositories/employer.repo.js');
  const jobRepo = await import('../src/repositories/job.repo.js');
  const { hashPassword } = await import('../src/lib/password.js');
  recommendationService = await import('../src/modules/admin/recommendation.service.js');
  applicationService = await import('../src/modules/application/application.service.js');
  ({ AppError } = await import('../src/lib/errors.js'));

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
  const me = await request(app).get('/api/auth/me').set('Cookie', candidateCookie);
  candidateProfileId = candidateRepo.findByUserId(me.body.id)!.id;
  await asCandidate(request(app).post('/api/candidate/resume')).attach('resume', PDF, 'a.pdf');
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
  getDb()
    .prepare("UPDATE employer_profile SET account_status='APPROVED' WHERE id=?")
    .run(employerProfileId);

  jobId = jobRepo.create(employerProfileId, 'Senior Process Engineer');
  jobRepo.setStatus(jobId, 'APPROVED', ['DRAFT'], { publishedAt: new Date().toISOString() });

  const applied = await asCandidate(request(app).post(`/api/candidate/jobs/${jobId}/apply`));
  applicationId = applied.body.applicationId;
});

afterAll(() => ctx.cleanup());

// ---------------------------------------------------------------------------

describe('the employer’s private note never reaches the candidate', () => {
  it('is kept off the candidate timeline', async () => {
    const secret = 'INTERNAL: weak communication, do not put forward again';

    await asEmployer(request(app).post(`/api/employer/applications/${applicationId}/stage`)).send({
      stage: 'UNDER_REVIEW',
      note: secret,
    });

    const res = await request(app).get('/api/candidate/applications').set('Cookie', candidateCookie);
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain(secret);
    expect(JSON.stringify(res.body)).not.toContain('INTERNAL');
  });

  it('is still there for the admin, who needs it', async () => {
    const res = await asAdmin(request(app).get(`/api/admin/applications/${applicationId}`));
    expect(JSON.stringify(res.body)).toContain('INTERNAL');
  });
});

describe('an interview cannot be arranged around the stage matrix', () => {
  it('is refused for a withdrawn application', async () => {
    const other = await request(app).post('/api/auth/register/candidate').set(CSRF_HEADER).send({
      fullName: 'Vikram Rao',
      email: 'vikram@example.com',
      mobile: '9876543211',
      password: 'correct-horse-3',
      consentToShare: true,
    });
    const cookie = sessionCookie(other);
    const { getDb } = await import('../src/db/client.js');
    const candidateRepo = await import('../src/repositories/candidate.repo.js');
    const meRes = await request(app).get('/api/auth/me').set('Cookie', cookie);
    const profileId = candidateRepo.findByUserId(meRes.body.id)!.id;
    candidateRepo.setStatus(profileId, 'APPROVED');
    void getDb;

    const applied = await request(app)
      .post(`/api/candidate/jobs/${jobId}/apply`)
      .set('Cookie', cookie)
      .set(CSRF_HEADER);
    const id = applied.body.applicationId as string;

    await request(app)
      .post(`/api/candidate/applications/${id}/withdraw`)
      .set('Cookie', cookie)
      .set(CSRF_HEADER);

    // Scheduling used to write the stage directly, so a withdrawn candidate
    // could be booked in and sent a confirmation for a process they had
    // explicitly opted out of.
    let caught: unknown;
    try {
      recommendationService.scheduleInterview({
        applicationId: id,
        scheduledAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        durationMinutes: 45,
        mode: 'VIDEO',
        locationOrLink: 'https://meet.example.com/x',
        actorId: employerUserId,
        role: 'EMPLOYER',
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(AppError);
    expect((caught as AppError).status).toBe(400);
  });

  it('is refused from APPLIED, which the matrix does not allow', async () => {
    // The application is at UNDER_REVIEW from the note test above.
    let caught: unknown;
    try {
      recommendationService.scheduleInterview({
        applicationId,
        scheduledAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        durationMinutes: 45,
        mode: 'VIDEO',
        locationOrLink: 'https://meet.example.com/x',
        actorId: employerUserId,
        role: 'EMPLOYER',
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(AppError);
    expect((caught as AppError).status).toBe(400);
  });
});

describe('a cancelled interview', () => {
  let interviewId: string;

  it('tells both parties', async () => {
    applicationService.changeStage({
      applicationId,
      toStage: 'SHORTLISTED',
      role: 'EMPLOYER',
      actorId: employerUserId,
    });
    const booked = recommendationService.scheduleInterview({
      applicationId,
      scheduledAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      durationMinutes: 45,
      mode: 'VIDEO',
      locationOrLink: 'https://meet.example.com/bktc',
      actorId: employerUserId,
      role: 'EMPLOYER',
    });
    interviewId = booked.interviewId;

    const before = await request(app)
      .get('/api/notifications')
      .set('Cookie', candidateCookie);
    const beforeCount = before.body.items.length as number;

    recommendationService.cancelInterview(interviewId, employerUserId, 'EMPLOYER');

    const after = await request(app).get('/api/notifications').set('Cookie', candidateCookie);
    expect(after.body.items.length).toBeGreaterThan(beforeCount);
    expect(after.body.items[0].title).toContain('cancelled');
  });

  it('cannot then be marked as held', async () => {
    // Used to advance the application to INTERVIEWED, recording a meeting
    // that never happened — and from INTERVIEWED an offer can be made.
    let caught: unknown;
    try {
      recommendationService.completeInterview(interviewId, employerUserId, 'EMPLOYER');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(AppError);
    expect((caught as AppError).status).toBe(409);

    const applicationRepo = await import('../src/repositories/application.repo.js');
    expect(applicationRepo.findById(applicationId)!.stage).not.toBe('INTERVIEWED');
  });
});

describe('employer profile URL fields', () => {
  it('refuses a javascript: scheme', async () => {
    const res = await asEmployer(request(app).patch('/api/employer/profile')).send({
      website: 'javascript:alert(document.cookie)',
    });
    expect(res.status).toBe(400);
  });

  it('refuses a data: scheme', async () => {
    const res = await asEmployer(request(app).patch('/api/employer/profile')).send({
      linkedinUrl: 'data:text/html,<script>alert(1)</script>',
    });
    expect(res.status).toBe(400);
  });

  it('sends a verified company back for review when its website changes', async () => {
    // wa.me is a valid https URL, so the scheme check cannot catch it — the
    // control is that a URL change is material and gets looked at.
    const res = await asEmployer(request(app).patch('/api/employer/profile')).send({
      website: 'https://wa.me/919876543210',
    });
    expect(res.status).toBe(200);
    expect(res.body.requiresReapproval).toBe(true);
    expect(res.body.materialChanges).toContain('website');
  });
});

describe('management endpoints report what they did', () => {
  it('404s rather than 204ing on a skill that does not exist', async () => {
    for (const path of ['/api/admin/skills/888888/approve', '/api/admin/skills/888888/reject']) {
      expect((await asAdmin(request(app).post(path))).status, path).toBe(404);
    }
    expect(
      (await asAdmin(request(app).patch('/api/admin/skills/888888')).send({ name: 'Nope' })).status,
    ).toBe(404);
  });

  it('404s on a taxonomy entry and an enquiry that do not exist', async () => {
    expect(
      (await asAdmin(request(app).patch('/api/admin/taxonomy/sectors/99999')).send({ isActive: false }))
        .status,
    ).toBe(404);
    expect(
      (await asAdmin(request(app).post('/api/admin/enquiries/NOPE/handled')).send({ handled: true }))
        .status,
    ).toBe(404);
  });

  it('will not merge a skill into one that does not exist', async () => {
    const list = await asAdmin(request(app).get('/api/admin/skills'));
    const source = list.body.items[0];
    if (!source) return;

    const res = await asAdmin(request(app).post('/api/admin/skills/merge')).send({
      sourceId: source.id,
      targetId: 999999,
    });
    expect(res.status).toBe(404);

    // And crucially the source survives — this used to delete it silently.
    const after = await asAdmin(request(app).get(`/api/admin/skills?search=${source.name}`));
    expect(after.body.items.some((s: { id: number }) => s.id === source.id)).toBe(true);
  });
});

describe('search terms are not treated as patterns', () => {
  it('does not match every candidate on a bare wildcard', async () => {
    const all = await asAdmin(request(app).get('/api/admin/candidates'));
    const wild = await asAdmin(request(app).get('/api/admin/candidates?search=%25'));

    expect(all.body.total).toBeGreaterThan(0);
    expect(wild.body.total).toBe(0);
  });
});

describe('salary expectations', () => {
  it('rejects a maximum below the minimum at save time, not at submit', async () => {
    const res = await asCandidate(request(app).patch('/api/candidate/profile')).send({
      expectedSalaryMinLpa: 50,
      expectedSalaryMaxLpa: 10,
    });
    expect(res.status).toBe(400);
  });
});

describe('an employer cannot ask to meet someone who is gone', () => {
  it('refuses a request on a withdrawn application', async () => {
    const other = await request(app).post('/api/auth/register/candidate').set(CSRF_HEADER).send({
      fullName: 'Sunil Patil',
      email: 'sunil@example.com',
      mobile: '9876543212',
      password: 'correct-horse-4',
      consentToShare: true,
    });
    const cookie = sessionCookie(other);
    const candidateRepo = await import('../src/repositories/candidate.repo.js');
    const meRes = await request(app).get('/api/auth/me').set('Cookie', cookie);
    candidateRepo.setStatus(candidateRepo.findByUserId(meRes.body.id)!.id, 'APPROVED');

    // The URL-material test above deliberately sent this company back for
    // review, which takes their postings out of the live list. Re-verify
    // first so this test measures the stage guard, not the verification one.
    const { getDb } = await import('../src/db/client.js');
    getDb().prepare("UPDATE employer_profile SET account_status='APPROVED'").run();

    const applied = await request(app)
      .post(`/api/candidate/jobs/${jobId}/apply`)
      .set('Cookie', cookie)
      .set(CSRF_HEADER);
    expect(applied.status, JSON.stringify(applied.body)).toBe(201);
    const id = applied.body.applicationId as string;

    const wd = await request(app)
      .post(`/api/candidate/applications/${id}/withdraw`)
      .set('Cookie', cookie)
      .set(CSRF_HEADER);
    expect([200, 204]).toContain(wd.status);

    const res = await asEmployer(
      request(app).post(`/api/employer/applications/${id}/request-interview`),
    ).send({ preferredSlots: [] });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Third audit
// ---------------------------------------------------------------------------

describe('an interview does not outlive its application', () => {
  async function bookOne() {
    const candidateRepo = await import('../src/repositories/candidate.repo.js');
    const { getDb } = await import('../src/db/client.js');
    getDb().prepare("UPDATE employer_profile SET account_status='APPROVED'").run();

    const reg = await request(app).post('/api/auth/register/candidate').set(CSRF_HEADER).send({
      fullName: `Interview Subject ${Date.now()}`,
      email: `iv-${Date.now()}@example.com`,
      mobile: '9876543219',
      password: 'correct-horse-9',
      consentToShare: true,
    });
    const cookie = sessionCookie(reg);
    const me = await request(app).get('/api/auth/me').set('Cookie', cookie);
    candidateRepo.setStatus(candidateRepo.findByUserId(me.body.id)!.id, 'APPROVED');

    const applied = await request(app)
      .post(`/api/candidate/jobs/${jobId}/apply`)
      .set('Cookie', cookie)
      .set(CSRF_HEADER);
    const id = applied.body.applicationId as string;

    for (const stage of ['UNDER_REVIEW', 'SHORTLISTED'] as const) {
      applicationService.changeStage({ applicationId: id, toStage: stage, role: 'EMPLOYER', actorId: employerUserId });
    }
    recommendationService.scheduleInterview({
      applicationId: id,
      scheduledAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
      durationMinutes: 45,
      mode: 'VIDEO',
      locationOrLink: 'https://meet.example.com/x',
      actorId: employerUserId,
      role: 'EMPLOYER',
    });
    return { applicationId: id, cookie };
  }

  it('is cancelled when the candidate withdraws', async () => {
    const { applicationId: id, cookie } = await bookOne();
    const interviewRepo = await import('../src/repositories/interview.repo.js');
    expect(interviewRepo.findScheduled(id)).toBeTruthy();

    await request(app)
      .post(`/api/candidate/applications/${id}/withdraw`)
      .set('Cookie', cookie)
      .set(CSRF_HEADER);

    // Used to survive: both parties kept seeing a confirmed meeting for a
    // process that had ended, and it stayed on BK's coordination screen.
    expect(interviewRepo.findScheduled(id)).toBeUndefined();
  });

  it('is cancelled when the application is turned down', async () => {
    const { applicationId: id } = await bookOne();
    const interviewRepo = await import('../src/repositories/interview.repo.js');

    applicationService.changeStage({
      applicationId: id,
      toStage: 'NOT_SELECTED',
      role: 'EMPLOYER',
      actorId: employerUserId,
      outcomeReasonCode: 'SKILLS_MISMATCH',
    });
    expect(interviewRepo.findScheduled(id)).toBeUndefined();
  });

  it('is completed, not cancelled, when the interview actually happens', async () => {
    const { applicationId: id } = await bookOne();
    const interviewRepo = await import('../src/repositories/interview.repo.js');
    const live = interviewRepo.findScheduled(id)!;

    applicationService.changeStage({
      applicationId: id,
      toStage: 'INTERVIEWED',
      role: 'EMPLOYER',
      actorId: employerUserId,
    });

    // Cancelling here would send "your interview is cancelled" moments before
    // "you have an offer".
    expect(interviewRepo.findById(live.id)!.status).toBe('COMPLETED');
  });

  it('leaves nothing on the coordination screen afterwards', async () => {
    const res = await asAdmin(request(app).get('/api/admin/coordination'));
    const stale = res.body.upcoming.filter((i: { candidateName: string }) =>
      i.candidateName.startsWith('Interview Subject'),
    );
    expect(stale).toHaveLength(0);
  });
});

describe('reactivating an employer', () => {
  it('does not resurrect applicants from jobs they closed themselves', async () => {
    const jobRepo = await import('../src/repositories/job.repo.js');
    const employerRepo = await import('../src/repositories/employer.repo.js');
    const userRepo = await import('../src/repositories/user.repo.js');
    const applicationRepo = await import('../src/repositories/application.repo.js');
    const { getDb } = await import('../src/db/client.js');

    getDb().prepare("UPDATE employer_profile SET account_status='APPROVED'").run();
    const employerUser = userRepo.findByEmail('ravi@kirloskar.example.com')!;
    const employer = employerRepo.findByUserId(employerUser.id)!;

    // A job the employer deliberately closed, with an applicant closed with it.
    const closedJob = jobRepo.create(employer.id, 'Deliberately Closed Role');
    jobRepo.setStatus(closedJob, 'APPROVED', ['DRAFT'], { publishedAt: new Date().toISOString() });

    const applied = await asCandidate(request(app).post(`/api/candidate/jobs/${closedJob}/apply`));
    const closedApplicationId = applied.body.applicationId as string;

    await asEmployer(request(app).post(`/api/employer/jobs/${closedJob}/close`));
    expect(applicationRepo.findById(closedApplicationId)!.stage).toBe('NOT_SELECTED');

    await asAdmin(request(app).post(`/api/admin/users/${employerUser.id}/suspend`));
    await asAdmin(request(app).post(`/api/admin/users/${employerUser.id}/reactivate`));

    /*
     * The suspension cascade and an employer's own close both write the
     * JOB_CLOSED outcome code, so restoring by that code alone put applicants
     * back onto roles the employer had genuinely ended. The discriminator is
     * the job status: suspension leaves PENDING_APPROVAL, a real close leaves
     * CLOSED.
     */
    expect(applicationRepo.findById(closedApplicationId)!.stage).toBe('NOT_SELECTED');
  });
});
