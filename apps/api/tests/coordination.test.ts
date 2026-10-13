/**
 * P6 exit checks — recommendations, interviews and private notes.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { formatDateTime } from '@bktc/shared';
import { createTestContext, CSRF_HEADER, sessionCookie, type TestContext } from './helpers/test-app.js';

let ctx: TestContext;
let app: Express;
let adminCookie: string;
let candidateCookie: string;
let employerCookie: string;
let employerUserId: string;
let candidateProfileId: string;
let jobId: string;
let applicationId: string;

const PDF = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(512, 0x20)]);
const inHours = (h: number) => new Date(Date.now() + h * 60 * 60 * 1000).toISOString();

beforeAll(async () => {
  ctx = await createTestContext('coordination');
  app = ctx.app;

  const { getDb } = await import('../src/db/client.js');
  const userRepo = await import('../src/repositories/user.repo.js');
  const candidateRepo = await import('../src/repositories/candidate.repo.js');
  const employerRepo = await import('../src/repositories/employer.repo.js');
  const jobRepo = await import('../src/repositories/job.repo.js');
  const { hashPassword } = await import('../src/lib/password.js');

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
});

afterAll(() => ctx.cleanup());

const asAdmin = (r: request.Test) => r.set('Cookie', adminCookie).set(CSRF_HEADER);
const asCandidate = (r: request.Test) => r.set('Cookie', candidateCookie).set(CSRF_HEADER);
const asEmployer = (r: request.Test) => r.set('Cookie', employerCookie).set(CSRF_HEADER);

describe('recommendation search', () => {
  it('finds candidates who could be put forward, ranked by matching skills', async () => {
    const res = await asAdmin(request(app).get(`/api/admin/jobs/${jobId}/candidate-search`));
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].fullName).toBe('Anita Desai');
    expect(typeof res.body.items[0].matchingSkills).toBe('number');
  });

  it('excludes anyone already on the job', async () => {
    await asCandidate(request(app).post(`/api/candidate/jobs/${jobId}/apply`));
    const res = await asAdmin(request(app).get(`/api/admin/jobs/${jobId}/candidate-search`));
    expect(res.body.items.length).toBe(0);

    // Reset for the recommendation tests.
    const { getDb } = await import('../src/db/client.js');
    getDb().prepare('DELETE FROM application').run();
  });

  it('is not reachable by an employer', async () => {
    const res = await asEmployer(request(app).get(`/api/admin/jobs/${jobId}/candidate-search`));
    expect(res.status).toBe(403);
  });
});

describe('recommending a candidate', () => {
  it('creates an application the candidate never made', async () => {
    const res = await asAdmin(request(app).post(`/api/admin/jobs/${jobId}/recommend`)).send({
      candidateProfileId,
    });
    expect(res.status).toBe(201);
    expect(res.body.alreadyExisted).toBe(false);
    applicationId = res.body.applicationId;

    const applicationRepo = await import('../src/repositories/application.repo.js');
    const application = applicationRepo.findById(applicationId)!;
    expect(application.source).toBe('ADMIN_RECOMMENDED');
    expect(application.is_recommended).toBe(1);
  });

  it('is idempotent — recommending twice does not duplicate', async () => {
    const res = await asAdmin(request(app).post(`/api/admin/jobs/${jobId}/recommend`)).send({
      candidateProfileId,
    });
    expect(res.status).toBe(201);
    expect(res.body.alreadyExisted).toBe(true);
    expect(res.body.applicationId).toBe(applicationId);
  });

  it('refuses without the candidate’s consent', async () => {
    const candidateRepo = await import('../src/repositories/candidate.repo.js');
    const { getDb } = await import('../src/db/client.js');

    const other = await request(app).post('/api/auth/register/candidate').set(CSRF_HEADER).send({
      fullName: 'Rohit Kulkarni',
      email: 'rohit@example.com',
      mobile: '9823012345',
      password: 'correct-horse-3',
      consentToShare: true,
    });
    const otherMe = await request(app).get('/api/auth/me').set('Cookie', sessionCookie(other));
    const otherProfileId = candidateRepo.findByUserId(otherMe.body.id)!.id;
    candidateRepo.setStatus(otherProfileId, 'APPROVED');

    // Simulate a profile with no consent on record.
    getDb().prepare('UPDATE candidate_profile SET consented_at = NULL WHERE id = ?').run(otherProfileId);

    const res = await asAdmin(request(app).post(`/api/admin/jobs/${jobId}/recommend`)).send({
      candidateProfileId: otherProfileId,
    });
    // Sharing a profile and CV with a company they did not choose needs a basis.
    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/consent/i);
  });

  it('refuses to recommend an unapproved candidate', async () => {
    const candidateRepo = await import('../src/repositories/candidate.repo.js');
    candidateRepo.setStatus(candidateProfileId, 'SUBMITTED');

    const res = await asAdmin(request(app).post(`/api/admin/jobs/${jobId}/recommend`)).send({
      candidateProfileId,
    });
    expect(res.status).toBe(400);

    candidateRepo.setStatus(candidateProfileId, 'APPROVED');
  });

  it('shows the candidate they were put forward, on their own tracker', async () => {
    const res = await asCandidate(request(app).get('/api/candidate/applications'));
    const application = res.body.items.find((a: { id: string }) => a.id === applicationId);
    expect(application.isRecommended).toBe(true);
  });

  it('pins them to the top of the employer’s list with the badge', async () => {
    const res = await asEmployer(request(app).get(`/api/employer/jobs/${jobId}/applications`));
    expect(res.body.items[0].isRecommended).toBe(true);
    // Still no salary or contact detail on the recommended path either.
    const serialised = JSON.stringify(res.body.items);
    expect(serialised).not.toContain('expectedSalary');
    expect(serialised).not.toContain('9876543210');
  });

  it('lets the candidate decline a role they did not choose', async () => {
    const res = await asCandidate(
      request(app).post(`/api/candidate/applications/${applicationId}/decline-recommendation`),
    );
    expect(res.status).toBe(200);

    const applicationRepo = await import('../src/repositories/application.repo.js');
    expect(applicationRepo.findById(applicationId)!.stage).toBe('WITHDRAWN');

    // Put it back for the interview tests.
    await asCandidate(request(app).post(`/api/candidate/jobs/${jobId}/apply`));
  });
});

describe('employer interview requests', () => {
  it('lets the employer ask, but not book', async () => {
    const list = await asEmployer(request(app).get(`/api/employer/jobs/${jobId}/applications`));
    applicationId = list.body.items[0].id;

    await asEmployer(request(app).post(`/api/employer/applications/${applicationId}/stage`)).send({
      stage: 'UNDER_REVIEW',
    });
    await asEmployer(request(app).post(`/api/employer/applications/${applicationId}/stage`)).send({
      stage: 'SHORTLISTED',
    });

    const booking = await asEmployer(
      request(app).post(`/api/employer/applications/${applicationId}/stage`),
    ).send({ stage: 'INTERVIEW_SCHEDULED' });
    expect(booking.status).toBe(403);

    const asked = await asEmployer(
      request(app).post(`/api/employer/applications/${applicationId}/request-interview`),
    ).send({ preferredSlots: ['Tue morning', 'Wed afternoon'], note: 'Keen to meet.' });
    expect(asked.status).toBe(201);
  });

  it('refuses a duplicate open request', async () => {
    const res = await asEmployer(
      request(app).post(`/api/employer/applications/${applicationId}/request-interview`),
    ).send({ preferredSlots: [] });
    expect(res.status).toBe(409);
  });

  it('surfaces the request on the admin coordination view', async () => {
    const res = await asAdmin(request(app).get('/api/admin/coordination'));
    expect(res.status).toBe(200);
    expect(res.body.requests.length).toBe(1);
    expect(res.body.requests[0].preferredSlots).toEqual(['Tue morning', 'Wed afternoon']);
  });
});

/**
 * Admin can no longer schedule, reschedule, cancel or complete an interview —
 * that is a hiring-coordination decision, and the product boundary (see
 * admin-coordination.routes.ts) puts all of that with Candidate and Employer.
 * The routes are gone, not just hidden, so these tests seed interview state
 * directly through the service layer (the domain capability itself is still
 * intact — only its admin HTTP surface was removed) and then assert the HTTP
 * surface is actually gone, not merely unlinked from the nav.
 */
describe('scheduling', () => {
  let interviewId: string;

  it('books the interview and advances the application (as the employer, who now owns this)', async () => {
    const service = await import('../src/modules/admin/recommendation.service.js');

    const result = service.scheduleInterview({
      applicationId,
      scheduledAt: inHours(48),
      durationMinutes: 45,
      mode: 'ONSITE',
      locationOrLink: 'Kirloskar works, Pune — gate 2',
      instructions: 'Ask for Ravi at reception. Carry a photo ID.',
      actorId: employerUserId,
      role: 'EMPLOYER',
    });
    interviewId = result.interviewId;

    const applicationRepo = await import('../src/repositories/application.repo.js');
    expect(applicationRepo.findById(applicationId)!.stage).toBe('INTERVIEW_SCHEDULED');
  });

  it('closes the employer’s open request', async () => {
    const res = await asAdmin(request(app).get('/api/admin/coordination'));
    expect(res.body.requests.length).toBe(0);
    expect(res.body.upcoming.length).toBe(1);
  });

  it('no longer exposes scheduling, cancelling or completing an interview to the admin API', async () => {
    const schedule = await asAdmin(
      request(app).post(`/api/admin/applications/${applicationId}/interview`),
    ).send({ scheduledAt: inHours(72), mode: 'VIDEO', locationOrLink: 'https://meet.example.com/x' });
    expect(schedule.status).toBe(404);

    const cancel = await asAdmin(request(app).post(`/api/admin/interviews/${interviewId}/cancel`));
    expect(cancel.status).toBe(404);

    const complete = await asAdmin(request(app).post(`/api/admin/interviews/${interviewId}/complete`));
    expect(complete.status).toBe(404);

    // Read-only visibility into the same record is preserved.
    const read = await asAdmin(
      request(app).get(`/api/admin/applications/${applicationId}/interviews`),
    );
    expect(read.status).toBe(200);
    expect(read.body.items.length).toBe(1);
  });

  it('no longer exposes admin stage-change or outcome-reason-altering decisions', async () => {
    const stage = await asAdmin(request(app).post(`/api/admin/applications/${applicationId}/stage`)).send({
      stage: 'NOT_SELECTED',
    });
    expect(stage.status).toBe(404);
  });

  it('shows both parties identical details', async () => {
    const candidateView = await asCandidate(
      request(app).get(`/api/candidate/applications/${applicationId}/interview`),
    );
    const employerView = await asEmployer(
      request(app).get(`/api/employer/applications/${applicationId}/interview`),
    );

    // A mismatch means somebody turns up at the wrong time or place.
    expect(candidateView.body.interview.scheduledAt).toBe(employerView.body.interview.scheduledAt);
    expect(candidateView.body.interview.locationOrLink).toBe(
      employerView.body.interview.locationOrLink,
    );
    expect(candidateView.body.interview.mode).toBe('ONSITE');
  });

  it('renders in IST with an explicit suffix', () => {
    // The developer's machine is also in IST, so a timezone bug survives all
    // manual testing. Assert the format directly.
    const formatted = formatDateTime('2026-08-05T04:30:00.000Z');
    expect(formatted).toMatch(/IST$/);
    // 04:30 UTC is 10:00 IST.
    expect(formatted).toContain('10:00');
  });

  it('records confirmation from each side independently', async () => {
    const before = await asCandidate(
      request(app).get(`/api/candidate/applications/${applicationId}/interview`),
    );
    expect(before.body.interview.youConfirmedAt).toBeNull();
    expect(before.body.interview.otherPartyConfirmed).toBe(false);

    await asCandidate(
      request(app).post(`/api/candidate/applications/${applicationId}/interview/confirm`),
    );

    const employerView = await asEmployer(
      request(app).get(`/api/employer/applications/${applicationId}/interview`),
    );
    expect(employerView.body.interview.otherPartyConfirmed).toBe(true);
    expect(employerView.body.interview.youConfirmedAt).toBeNull();

    await asEmployer(
      request(app).post(`/api/employer/applications/${applicationId}/interview/confirm`),
    );

    const admin = await asAdmin(request(app).get(`/api/admin/applications/${applicationId}/interviews`));
    expect(admin.body.items[0].candidateConfirmedAt).toBeTruthy();
    expect(admin.body.items[0].employerConfirmedAt).toBeTruthy();
  });

  it('supersedes rather than overwrites when rescheduled (as the employer, via the service)', async () => {
    const service = await import('../src/modules/admin/recommendation.service.js');

    const result = service.scheduleInterview({
      applicationId,
      scheduledAt: inHours(72),
      durationMinutes: 45,
      mode: 'VIDEO',
      locationOrLink: 'https://meet.example.com/rescheduled',
      actorId: employerUserId,
      role: 'EMPLOYER',
    });
    expect(result.rescheduled).toBe(true);

    const all = await asAdmin(request(app).get(`/api/admin/applications/${applicationId}/interviews`));
    // The original time survives — "we moved it twice" stays answerable.
    expect(all.body.items.length).toBe(2);
    const superseded = all.body.items.find((i: { status: string }) => i.status === 'RESCHEDULED');
    expect(superseded.supersededById).toBeTruthy();
  });

  it('advances to INTERVIEWED when completed (as the employer, via the service)', async () => {
    const service = await import('../src/modules/admin/recommendation.service.js');

    const all = await asAdmin(request(app).get(`/api/admin/applications/${applicationId}/interviews`));
    const live = all.body.items.find((i: { status: string }) => i.status === 'SCHEDULED');

    service.completeInterview(live.id, employerUserId, 'EMPLOYER');

    const applicationRepo = await import('../src/repositories/application.repo.js');
    expect(applicationRepo.findById(applicationId)!.stage).toBe('INTERVIEWED');
    expect(interviewId).toBeTruthy();
  });

  it('refuses even a crafted direct service call claiming the admin role — the matrix rejects it, not just the missing route', async () => {
    const service = await import('../src/modules/admin/recommendation.service.js');
    const userRepo = await import('../src/repositories/user.repo.js');
    const admin = userRepo.findByEmail('admin@bktc.test')!;

    let caught: unknown;
    try {
      service.scheduleInterview({
        applicationId,
        scheduledAt: inHours(96),
        durationMinutes: 45,
        mode: 'VIDEO',
        locationOrLink: 'https://meet.example.com/crafted',
        actorId: admin.id,
        role: 'ADMIN',
      });
    } catch (err) {
      caught = err;
    }
    // INTERVIEWED is terminal-for-admin here: there is no legal ADMIN
    // transition out of it at all, let alone to INTERVIEW_SCHEDULED — so this
    // fails on the matrix itself, the same authority check a real request
    // would hit, not merely because the admin route is unmounted.
    expect(caught).toBeTruthy();
  });
});

describe('private admin notes', () => {
  let noteId: string;

  it('records a note against a candidate', async () => {
    const res = await asAdmin(request(app).post('/api/admin/notes')).send({
      entityType: 'CANDIDATE',
      entityId: candidateProfileId,
      body: 'Strong on HAZOP. Flagged salary expectations to Ravi verbally.',
    });
    expect(res.status).toBe(201);
    noteId = res.body.id;
    expect(res.body.authorEmail).toBe('admin@bktc.test');
  });

  it('is invisible to the candidate and the employer', async () => {
    const profile = await asCandidate(request(app).get('/api/candidate/profile'));
    expect(JSON.stringify(profile.body)).not.toContain('HAZOP. Flagged');

    const applicants = await asEmployer(request(app).get(`/api/employer/jobs/${jobId}/applications`));
    expect(JSON.stringify(applicants.body)).not.toContain('HAZOP. Flagged');

    // And there is no route at all.
    expect((await asCandidate(request(app).get('/api/admin/notes'))).status).toBe(403);
    expect((await asEmployer(request(app).get('/api/admin/notes'))).status).toBe(403);
  });

  it('does not leak a candidate note onto their applications', async () => {
    const res = await asAdmin(
      request(app).get(`/api/admin/notes?entityType=APPLICATION&entityId=${applicationId}`),
    );
    expect(res.body.items.length).toBe(0);
  });

  it('lets only the author delete their own note', async () => {
    const userRepo = await import('../src/repositories/user.repo.js');
    const { hashPassword } = await import('../src/lib/password.js');
    userRepo.create({
      email: 'admin2@bktc.test',
      passwordHash: await hashPassword('admin-password-2'),
      role: 'ADMIN',
    });
    const second = sessionCookie(
      await request(app)
        .post('/api/auth/login')
        .set(CSRF_HEADER)
        .send({ email: 'admin2@bktc.test', password: 'admin-password-2' }),
    );

    const other = await request(app)
      .delete(`/api/admin/notes/${noteId}`)
      .set('Cookie', second)
      .set(CSRF_HEADER);
    expect(other.status).toBe(400);

    const own = await asAdmin(request(app).delete(`/api/admin/notes/${noteId}`));
    expect(own.status).toBe(204);
  });

  it('sweeps notes whose target no longer exists', async () => {
    const interviewRepo = await import('../src/repositories/interview.repo.js');
    const userRepo = await import('../src/repositories/user.repo.js');
    const admin = userRepo.findByEmail('admin@bktc.test')!;

    interviewRepo.createNote({
      authorId: admin.id,
      entityType: 'JOB',
      entityId: 'no-such-job',
      body: 'orphan',
    });
    // The polymorphic key cannot carry a foreign key, so orphans are swept.
    expect(interviewRepo.deleteOrphanedNotes()).toBeGreaterThan(0);
  });
});
