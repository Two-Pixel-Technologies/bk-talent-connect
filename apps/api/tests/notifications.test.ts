/**
 * P7 exit checks — the notification matrix.
 *
 * The plan's exit criterion is that every row of the Proposal p8 matrix
 * produces exactly the listed recipients, walked row by row. So this suite
 * drives one real journey through the portal that triggers all fifteen events,
 * records who actually received each one, and then compares that against
 * NOTIFICATION_MATRIX — every row, including the rows whose answer is "nobody
 * else".
 *
 * That comparison catches both directions, which matters: v1 of the plan sent
 * employers a "new application" notification the matrix marks "–", and nothing
 * caught it because the test only checked that the intended recipient got one.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { NOTIFICATION_MATRIX, formatDateTime, type NotificationEvent } from '@bktc/shared';
import { createTestContext, CSRF_HEADER, sessionCookie, type TestContext } from './helpers/test-app.js';

let ctx: TestContext;
let app: Express;

let adminCookie: string;
let adminId: string;
let secondAdminId: string;
let candidateCookie: string;
let candidateUserId: string;
let employerCookie: string;
let employerUserId: string;
let companyName: string;

let offerApplicationId: string;
let recommendedApplicationId: string;
let interviewScheduledAt: string;

/** Distinctive figures, so a leak into notification copy is unmistakable. */
const CANDIDATE_CURRENT_SALARY = 1_234_000;
const JOB_BAND_MIN = 2_100_000;
const JOB_BAND_MAX = 2_800_000;

const PDF = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(512, 0x20)]);
const inHours = (h: number) => new Date(Date.now() + h * 60 * 60 * 1000).toISOString();

const COMPLETE_JOB = {
  title: 'Automation Lead',
  department: 'Controls',
  numberOfPositions: 1,
  sectorSlug: 'industrial-automation-instrumentation',
  functionSlug: 'automation-controls',
  citySlug: 'pune',
  state: 'Maharashtra',
  workType: 'ONSITE' as const,
  minExperience: 6,
  maxExperience: 12,
  educationRequirement: 'BTECH' as const,
  requiredSkills: ['PLC Programming', 'SCADA', 'Functional Safety'],
  goodToHaveSkills: ['Six Sigma'],
  salaryBandMinLpa: JOB_BAND_MIN / 100_000,
  salaryBandMaxLpa: JOB_BAND_MAX / 100_000,
  description:
    'We are hiring an automation lead to own control system design and commissioning across two ' +
    'plants. You will specify and program PLC and SCADA systems, lead functional safety reviews, ' +
    'and work with the maintenance team to bring reliability data into the control layer. The ' +
    'role suits someone who has taken projects from specification through factory acceptance ' +
    'testing to site commissioning and wants ownership rather than execution of someone else ' +
    'plan. You will manage two engineers and a rotating pool of contractors during shutdowns, ' +
    'and you will be the technical authority the plant manager turns to when a line stops. We ' +
    'have invested steadily in instrumentation over the last four years and want somebody to ' +
    'make that investment pay. Comfort with regulated documentation is expected, as is the ' +
    'willingness to be on the shop floor when it matters rather than only at a desk.',
};

// ---------------------------------------------------------------------------
// Observation helpers
// ---------------------------------------------------------------------------

interface Delivered {
  readonly role: string;
  readonly userId: string;
  readonly title: string;
  readonly body: string | null;
}

let deliveredOf: (event: NotificationEvent) => Delivered[];
let allDelivered: () => Delivered[];

beforeAll(async () => {
  ctx = await createTestContext('notifications');
  app = ctx.app;

  const { getDb } = await import('../src/db/client.js');
  const userRepo = await import('../src/repositories/user.repo.js');
  const candidateRepo = await import('../src/repositories/candidate.repo.js');
  const employerRepo = await import('../src/repositories/employer.repo.js');
  const jobRepo = await import('../src/repositories/job.repo.js');
  const { hashPassword } = await import('../src/lib/password.js');

  const rows = (sql: string, ...params: unknown[]) =>
    getDb().prepare(sql).all(...params) as Delivered[];

  deliveredOf = (event) =>
    rows(
      `SELECT u.role AS role, n.user_id AS userId, n.title AS title, n.body AS body
         FROM notification n JOIN user u ON u.id = n.user_id
        WHERE n.event = ? ORDER BY u.role`,
      event,
    );
  allDelivered = () =>
    rows(
      `SELECT u.role AS role, n.user_id AS userId, n.title AS title, n.body AS body
         FROM notification n JOIN user u ON u.id = n.user_id`,
    );

  /*
   * Two admins, deliberately.
   *
   * "ADMIN" in the matrix means every active admin, and several events exclude
   * whichever admin performed the action. With one admin those two rules cancel
   * out and the row looks like it delivers to nobody — which is exactly the bug
   * a second admin exposes.
   */
  const hash = await hashPassword('admin-password-1');
  adminId = userRepo.create({ email: 'admin@bktc.test', passwordHash: hash, role: 'ADMIN' });
  secondAdminId = userRepo.create({ email: 'admin2@bktc.test', passwordHash: hash, role: 'ADMIN' });

  adminCookie = sessionCookie(
    await request(app)
      .post('/api/auth/login')
      .set(CSRF_HEADER)
      .send({ email: 'admin@bktc.test', password: 'admin-password-1' }),
  );

  const asAdmin = (r: request.Test) => r.set('Cookie', adminCookie).set(CSRF_HEADER);

  // --- CANDIDATE_REGISTERED -------------------------------------------------
  const candidate = await request(app).post('/api/auth/register/candidate').set(CSRF_HEADER).send({
    fullName: 'Anita Desai',
    email: 'anita@example.com',
    mobile: '9876543210',
    password: 'correct-horse-1',
    consentToShare: true,
  });
  candidateCookie = sessionCookie(candidate);
  const asCandidate = (r: request.Test) => r.set('Cookie', candidateCookie).set(CSRF_HEADER);

  const me = await request(app).get('/api/auth/me').set('Cookie', candidateCookie);
  candidateUserId = me.body.id;
  const candidateProfileId = candidateRepo.findByUserId(candidateUserId)!.id;

  await asCandidate(request(app).post('/api/candidate/resume')).attach('resume', PDF, 'anita.pdf');
  candidateRepo.updateFields(candidateProfileId, { current_salary: CANDIDATE_CURRENT_SALARY });
  getDb()
    .prepare("UPDATE candidate_profile SET profile_status='SUBMITTED' WHERE id=?")
    .run(candidateProfileId);

  // --- CANDIDATE_PROFILE_APPROVED -------------------------------------------
  await asAdmin(request(app).post(`/api/admin/candidates/${candidateProfileId}/review`)).send({
    decision: 'APPROVE',
    expectedStatus: 'SUBMITTED',
  });

  // --- CANDIDATE_PROFILE_CHANGES_REQUESTED ----------------------------------
  // A second candidate, so the first stays approved and able to apply.
  const other = await request(app).post('/api/auth/register/candidate').set(CSRF_HEADER).send({
    fullName: 'Vikram Rao',
    email: 'vikram@example.com',
    mobile: '9876543211',
    password: 'correct-horse-2',
    consentToShare: true,
  });
  const otherMe = await request(app).get('/api/auth/me').set('Cookie', sessionCookie(other));
  const otherProfileId = candidateRepo.findByUserId(otherMe.body.id)!.id;
  getDb()
    .prepare("UPDATE candidate_profile SET profile_status='SUBMITTED' WHERE id=?")
    .run(otherProfileId);
  await asAdmin(request(app).post(`/api/admin/candidates/${otherProfileId}/review`)).send({
    decision: 'REQUEST_CHANGES',
    expectedStatus: 'SUBMITTED',
    note: 'Please add your last two roles with dates.',
  });
  // Approved afterwards by direct write, so they can be recommended later
  // without raising a second approval notification.
  candidateRepo.setStatus(otherProfileId, 'APPROVED');

  // --- EMPLOYER_ACCOUNT_APPROVED --------------------------------------------
  companyName = 'Kirloskar Systems';
  const employer = await request(app).post('/api/auth/register/employer').set(CSRF_HEADER).send({
    companyName,
    hrContactName: 'Ravi Menon',
    email: 'ravi@kirloskar.example.com',
    hrContactPhone: '9876500000',
    password: 'correct-horse-3',
  });
  employerCookie = sessionCookie(employer);
  const asEmployer = (r: request.Test) => r.set('Cookie', employerCookie).set(CSRF_HEADER);

  const employerMe = await request(app).get('/api/auth/me').set('Cookie', employerCookie);
  employerUserId = employerMe.body.id;
  const employerProfileId = employerRepo.findByUserId(employerUserId)!.id;
  getDb()
    .prepare("UPDATE employer_profile SET account_status='SUBMITTED' WHERE id=?")
    .run(employerProfileId);
  await asAdmin(request(app).post(`/api/admin/employers/${employerProfileId}/review`)).send({
    decision: 'APPROVE',
    expectedStatus: 'SUBMITTED',
  });

  // --- JOB_SUBMITTED, JOB_SENT_BACK, JOB_APPROVED ---------------------------
  const created = await asEmployer(request(app).post('/api/employer/jobs')).send({
    title: COMPLETE_JOB.title,
  });
  const jobId = created.body.id as string;
  await asEmployer(request(app).patch(`/api/employer/jobs/${jobId}`)).send(COMPLETE_JOB);
  await asEmployer(request(app).post(`/api/employer/jobs/${jobId}/submit`));

  await asAdmin(request(app).post(`/api/admin/jobs/${jobId}/review`)).send({
    decision: 'REQUEST_CHANGES',
    expectedStatus: 'PENDING_APPROVAL',
    note: 'Please widen the experience range — six years is narrow for this title.',
  });
  await asEmployer(request(app).post(`/api/employer/jobs/${jobId}/submit`));
  await asAdmin(request(app).post(`/api/admin/jobs/${jobId}/review`)).send({
    decision: 'APPROVE',
    expectedStatus: 'PENDING_APPROVAL',
  });

  // --- APPLICATION_SUBMITTED ------------------------------------------------
  const applied = await asCandidate(request(app).post(`/api/candidate/jobs/${jobId}/apply`));
  offerApplicationId = applied.body.applicationId as string;

  // --- EMPLOYER_PIPELINE_ACTION ---------------------------------------------
  await asEmployer(request(app).post(`/api/employer/applications/${offerApplicationId}/stage`)).send(
    { stage: 'UNDER_REVIEW' },
  );

  /*
   * --- CANDIDATE_SHORTLISTED ------------------------------------------------
   *
   * Driven by the admin, not the employer, and that is the point of the row:
   * p8 lists the employer as a recipient because BK also shortlists on their
   * behalf. When the employer clicks it themselves they are the actor and are
   * excluded — a one-seat employer account being told about its own click is
   * noise, and that case is asserted separately below.
   */
  await asAdmin(request(app).post(`/api/admin/applications/${offerApplicationId}/stage`)).send({
    stage: 'SHORTLISTED',
  });

  // --- EMPLOYER_INTERVIEW_REQUESTED -----------------------------------------
  await asEmployer(
    request(app).post(`/api/employer/applications/${offerApplicationId}/request-interview`),
  ).send({ preferredSlots: [inHours(48), inHours(72)], note: 'Afternoons suit us best.' });

  // --- INTERVIEW_CONFIRMED --------------------------------------------------
  interviewScheduledAt = inHours(50);
  await asAdmin(request(app).post(`/api/admin/applications/${offerApplicationId}/interview`)).send({
    scheduledAt: interviewScheduledAt,
    durationMinutes: 45,
    mode: 'VIDEO',
    locationOrLink: 'https://meet.example.com/bktc-anita',
  });

  // --- OFFER_MADE -----------------------------------------------------------
  await asAdmin(request(app).post(`/api/admin/applications/${offerApplicationId}/stage`)).send({
    stage: 'INTERVIEWED',
  });
  await asAdmin(request(app).post(`/api/admin/applications/${offerApplicationId}/stage`)).send({
    stage: 'OFFER_MADE',
  });

  // --- CANDIDATE_RECOMMENDED ------------------------------------------------
  const recommended = await asAdmin(request(app).post(`/api/admin/jobs/${jobId}/recommend`)).send({
    candidateProfileId: otherProfileId,
  });
  recommendedApplicationId = recommended.body.applicationId as string;

  // --- CANDIDATE_NOT_SELECTED -----------------------------------------------
  await asAdmin(request(app).post(`/api/admin/applications/${recommendedApplicationId}/stage`)).send(
    { stage: 'NOT_SELECTED', note: 'Not the right fit for this brief.' },
  );

  // Referenced so the linter sees the seeded ids as used by the suite.
  void jobRepo;
});

afterAll(() => ctx.cleanup());

// ---------------------------------------------------------------------------
// The matrix, row by row
// ---------------------------------------------------------------------------

describe('the p8 notification matrix', () => {
  it.each(NOTIFICATION_MATRIX)(
    '$event reaches exactly $recipients',
    ({ event, recipients }) => {
      const delivered = deliveredOf(event);

      /*
       * Every row must actually fire somewhere in the journey above. A row
       * that never fires would otherwise pass this test by delivering to
       * nobody and matching nothing — a silent feature gap dressed as a green
       * check.
       */
      expect(delivered.length, `${event} was never raised by any journey`).toBeGreaterThan(0);

      const gotRoles = [...new Set(delivered.map((d) => d.role))].sort();
      expect(gotRoles).toEqual([...recipients].sort());
    },
  );

  it('notifies both admins, not only the one who acted', () => {
    // EMPLOYER_PIPELINE_ACTION has an employer actor, so no admin is excluded.
    const recipients = deliveredOf('EMPLOYER_PIPELINE_ACTION').map((d) => d.userId);
    expect(recipients).toContain(adminId);
    expect(recipients).toContain(secondAdminId);
  });

  it('does not tell an admin about their own action', () => {
    // The approving admin is excluded; a second admin would still be told if
    // the matrix listed ADMIN here, which it does not.
    const recipients = deliveredOf('CANDIDATE_PROFILE_APPROVED').map((d) => d.userId);
    expect(recipients).not.toContain(adminId);
    expect(recipients).toEqual([candidateUserId]);
  });

  it('tells the candidate when the employer shortlists, without echoing it back', async () => {
    /*
     * The other half of the CANDIDATE_SHORTLISTED row. The candidate must hear
     * about it however it happened; the employer who clicked the button must
     * not be told about their own click.
     */
    const jobRepo = await import('../src/repositories/job.repo.js');
    const employerRepo = await import('../src/repositories/employer.repo.js');
    const { getDb } = await import('../src/db/client.js');

    const employerProfileId = employerRepo.findByUserId(employerUserId)!.id;
    const jobId = jobRepo.create(employerProfileId, 'Reliability Engineer');
    jobRepo.setStatus(jobId, 'APPROVED', ['DRAFT'], { publishedAt: new Date().toISOString() });

    const applied = await request(app)
      .post(`/api/candidate/jobs/${jobId}/apply`)
      .set('Cookie', candidateCookie)
      .set(CSRF_HEADER);
    const applicationId = applied.body.applicationId as string;

    for (const stage of ['UNDER_REVIEW', 'SHORTLISTED']) {
      const res = await request(app)
        .post(`/api/employer/applications/${applicationId}/stage`)
        .set('Cookie', employerCookie)
        .set(CSRF_HEADER)
        .send({ stage });
      expect(res.status).toBe(200);
    }

    const forThisApplication = getDb()
      .prepare(
        `SELECT u.role AS role FROM notification n JOIN user u ON u.id = n.user_id
          WHERE n.event = 'CANDIDATE_SHORTLISTED' AND n.entity_id = ?`,
      )
      .all(applicationId) as { role: string }[];

    expect(forThisApplication.map((r) => r.role)).toEqual(['CANDIDATE']);
  });

  it('never notifies the employer of a new application', () => {
    // p8 marks the employer column "–" for this row. It is the one the
    // previous plan got wrong, so it is asserted on its own.
    const roles = deliveredOf('APPLICATION_SUBMITTED').map((d) => d.role);
    expect(roles).not.toContain('EMPLOYER');
  });
});

// ---------------------------------------------------------------------------
// Privacy
// ---------------------------------------------------------------------------

describe('notification content', () => {
  it('contains no salary figure anywhere', () => {
    const text = allDelivered()
      .map((d) => `${d.title} ${d.body ?? ''}`)
      .join('\n');

    for (const figure of [
      String(CANDIDATE_CURRENT_SALARY),
      String(JOB_BAND_MIN),
      String(JOB_BAND_MAX),
      '12.34',
      '21 LPA',
      '28 LPA',
      '₹',
    ]) {
      expect(text, `notification text leaked ${figure}`).not.toContain(figure);
    }
  });

  it('never names the employer in a candidate-facing notification', () => {
    /*
     * Candidate job views are anonymous by design — toCandidateView omits
     * employer identity until shortlist. A notification reading "Kirloskar
     * Systems shortlisted you" would walk straight around that serializer.
     */
    const candidateText = allDelivered()
      .filter((d) => d.role === 'CANDIDATE')
      .map((d) => `${d.title} ${d.body ?? ''}`)
      .join('\n');

    expect(candidateText).not.toContain(companyName);
    expect(candidateText.length).toBeGreaterThan(0);
  });

  it('gives both parties the same interview time, in IST', () => {
    const delivered = deliveredOf('INTERVIEW_CONFIRMED');
    const when = formatDateTime(interviewScheduledAt);

    expect(when).toContain('IST');
    expect(delivered).toHaveLength(2);
    for (const d of delivered) {
      expect(d.body, `${d.role} did not get the time in IST`).toContain(when);
    }
  });

  it('stores the link as a subject, not a URL', async () => {
    const res = await request(app)
      .get('/api/notifications')
      .set('Cookie', candidateCookie)
      .set(CSRF_HEADER);

    expect(res.status).toBe(200);
    const links = res.body.items.map((n: { link: unknown }) => n.link).filter(Boolean);
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toHaveProperty('entityType');
      expect(link).toHaveProperty('entityId');
      expect(JSON.stringify(link)).not.toContain('/');
    }
  });
});

// ---------------------------------------------------------------------------
// The feed API
// ---------------------------------------------------------------------------

describe('the feed', () => {
  it('returns only the caller’s own notifications', async () => {
    const mine = await request(app).get('/api/notifications').set('Cookie', candidateCookie);
    const theirs = await request(app).get('/api/notifications').set('Cookie', employerCookie);

    expect(mine.status).toBe(200);
    expect(theirs.status).toBe(200);
    expect(mine.body.items.length).toBeGreaterThan(0);
    expect(theirs.body.items.length).toBeGreaterThan(0);

    const mineIds = new Set(mine.body.items.map((n: { id: string }) => n.id));
    for (const n of theirs.body.items) expect(mineIds.has(n.id)).toBe(false);
  });

  it('requires a session', async () => {
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(401);
  });

  it('marks one read and decrements the badge', async () => {
    const before = await request(app)
      .get('/api/notifications/unread-count')
      .set('Cookie', candidateCookie);
    expect(before.body.count).toBeGreaterThan(0);

    const feed = await request(app)
      .get('/api/notifications?unreadOnly=true')
      .set('Cookie', candidateCookie);
    const target = feed.body.items[0] as { id: string };

    const marked = await request(app)
      .post(`/api/notifications/${target.id}/read`)
      .set('Cookie', candidateCookie)
      .set(CSRF_HEADER);
    expect(marked.status).toBe(204);

    const after = await request(app)
      .get('/api/notifications/unread-count')
      .set('Cookie', candidateCookie);
    expect(after.body.count).toBe(before.body.count - 1);
  });

  it('cannot mark someone else’s notification read', async () => {
    const theirs = await request(app).get('/api/notifications').set('Cookie', employerCookie);
    const target = theirs.body.items[0] as { id: string };

    const before = await request(app)
      .get('/api/notifications/unread-count')
      .set('Cookie', employerCookie);

    const res = await request(app)
      .post(`/api/notifications/${target.id}/read`)
      .set('Cookie', candidateCookie)
      .set(CSRF_HEADER);
    expect(res.status).toBe(404);

    const after = await request(app)
      .get('/api/notifications/unread-count')
      .set('Cookie', employerCookie);
    expect(after.body.count).toBe(before.body.count);
  });

  it('clears the badge with read-all', async () => {
    const res = await request(app)
      .post('/api/notifications/read-all')
      .set('Cookie', candidateCookie)
      .set(CSRF_HEADER);
    expect(res.status).toBe(200);

    const count = await request(app)
      .get('/api/notifications/unread-count')
      .set('Cookie', candidateCookie);
    expect(count.body.count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Bulk closure
// ---------------------------------------------------------------------------

describe('closing a posting', () => {
  it('tells every pending applicant but does not flood the admin bell', async () => {
    const { getDb } = await import('../src/db/client.js');
    const notificationRepo = await import('../src/repositories/notification.repo.js');

    // The recommended application is already NOT_SELECTED; put a fresh one at
    // APPLIED on a second posting and close it.
    const jobRepo = await import('../src/repositories/job.repo.js');
    const employerRepo = await import('../src/repositories/employer.repo.js');
    const employerProfileId = employerRepo.findByUserId(employerUserId)!.id;

    const jobId = jobRepo.create(employerProfileId, 'Maintenance Engineer');
    jobRepo.setStatus(jobId, 'APPROVED', ['DRAFT'], { publishedAt: new Date().toISOString() });

    const applied = await request(app)
      .post(`/api/candidate/jobs/${jobId}/apply`)
      .set('Cookie', candidateCookie)
      .set(CSRF_HEADER);
    expect(applied.status).toBe(201);

    // Baseline taken after the apply: that itself notifies the admin team, and
    // counting from before it would credit the closure with a row it did not
    // write.
    const before = notificationRepo.countUnread(adminId);

    const closed = await request(app)
      .post(`/api/employer/jobs/${jobId}/close`)
      .set('Cookie', employerCookie)
      .set(CSRF_HEADER);
    expect(closed.status).toBe(200);
    expect(closed.body.closedApplications).toBe(1);

    const candidateRows = getDb()
      .prepare(
        `SELECT title FROM notification
          WHERE user_id = ? AND event = 'CANDIDATE_NOT_SELECTED'
            AND title LIKE 'A role you applied to has closed'`,
      )
      .all(candidateUserId) as { title: string }[];
    expect(candidateRows).toHaveLength(1);

    // One summary for the admin team, not one per applicant.
    const after = notificationRepo.countUnread(adminId);
    expect(after - before).toBe(1);
  });
});
