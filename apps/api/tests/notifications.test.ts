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
   * p8 lists the employer as a recipient of their OWN shortlist action
   * because the matrix also covers BK shortlisting on their behalf — that
   * second path no longer exists (see admin-pipeline.routes.ts's and
   * admin-coordination.routes.ts's file comments: interview coordination and
   * every hiring decision now belong to Candidate/Employer, not Admin). So
   * this suite drives the one path that still exists — the employer's own
   * action — and the "actor excluded from their own notification" case is
   * asserted separately below using the dedicated self-action test.
   *
   * Loaded dynamically here (not as a static top-level import) for the same
   * reason createTestContext loads everything dynamically: these modules
   * reach config/env.ts, which must not be parsed before DATABASE_PATH is set.
   */
  const applicationService = await import('../src/modules/application/application.service.js');
  const recommendationService = await import('../src/modules/admin/recommendation.service.js');
  const candidateRepo2 = await import('../src/repositories/candidate.repo.js');

  applicationService.changeStage({
    applicationId: offerApplicationId,
    toStage: 'SHORTLISTED',
    role: 'EMPLOYER',
    actorId: employerUserId,
  });

  // --- EMPLOYER_INTERVIEW_REQUESTED -----------------------------------------
  await asEmployer(
    request(app).post(`/api/employer/applications/${offerApplicationId}/request-interview`),
  ).send({ preferredSlots: [inHours(48), inHours(72)], note: 'Afternoons suit us best.' });

  // --- INTERVIEW_CONFIRMED ---------------------------------------------------
  // Scheduling is the employer's own action now, not BK's — see the file
  // comment above.
  interviewScheduledAt = inHours(50);
  recommendationService.scheduleInterview({
    applicationId: offerApplicationId,
    scheduledAt: interviewScheduledAt,
    durationMinutes: 45,
    mode: 'VIDEO',
    locationOrLink: 'https://meet.example.com/bktc-anita',
    actorId: employerUserId,
    role: 'EMPLOYER',
  });

  // --- OFFER_MADE -----------------------------------------------------------
  applicationService.changeStage({
    applicationId: offerApplicationId,
    toStage: 'INTERVIEWED',
    role: 'EMPLOYER',
    actorId: employerUserId,
  });
  applicationService.changeStage({
    applicationId: offerApplicationId,
    toStage: 'OFFER_MADE',
    role: 'EMPLOYER',
    actorId: employerUserId,
  });

  // --- OFFER_ACCEPTED, CANDIDATE_JOINED --------------------------------------
  // The candidate's own decision on the offer, then the employer confirming
  // joining — both previously admin-only, now owned by the party who
  // actually makes each call in a real hiring process.
  applicationService.changeStage({
    applicationId: offerApplicationId,
    toStage: 'OFFER_ACCEPTED',
    role: 'CANDIDATE',
    actorId: candidateUserId,
  });
  applicationService.changeStage({
    applicationId: offerApplicationId,
    toStage: 'JOINED',
    role: 'EMPLOYER',
    actorId: employerUserId,
  });

  // --- OFFER_DECLINED --------------------------------------------------------
  // A second candidate taken all the way to an offer on the same job, so the
  // decline path can be exercised independently of the accept path above.
  const decliner = await request(app).post('/api/auth/register/candidate').set(CSRF_HEADER).send({
    fullName: 'Sunil Patil',
    email: 'sunil@example.com',
    mobile: '9876543212',
    password: 'correct-horse-4',
    consentToShare: true,
  });
  const declinerMe = await request(app).get('/api/auth/me').set('Cookie', sessionCookie(decliner));
  const declinerProfileId = candidateRepo2.findByUserId(declinerMe.body.id)!.id;
  candidateRepo2.setStatus(declinerProfileId, 'APPROVED');
  const declinerApplied = await request(app)
    .post(`/api/candidate/jobs/${jobId}/apply`)
    .set('Cookie', sessionCookie(decliner))
    .set(CSRF_HEADER);
  const declineApplicationId = declinerApplied.body.applicationId as string;

  for (const stage of ['UNDER_REVIEW', 'SHORTLISTED'] as const) {
    applicationService.changeStage({
      applicationId: declineApplicationId,
      toStage: stage,
      role: 'EMPLOYER',
      actorId: employerUserId,
    });
  }
  recommendationService.scheduleInterview({
    applicationId: declineApplicationId,
    scheduledAt: inHours(60),
    durationMinutes: 30,
    mode: 'PHONE',
    locationOrLink: '+91 98765 00000',
    actorId: employerUserId,
    role: 'EMPLOYER',
  });
  for (const stage of ['INTERVIEWED', 'OFFER_MADE'] as const) {
    applicationService.changeStage({
      applicationId: declineApplicationId,
      toStage: stage,
      role: 'EMPLOYER',
      actorId: employerUserId,
    });
  }
  applicationService.changeStage({
    applicationId: declineApplicationId,
    toStage: 'OFFER_DECLINED',
    role: 'CANDIDATE',
    actorId: declinerMe.body.id,
  });

  // --- CANDIDATE_RECOMMENDED ------------------------------------------------
  const recommended = await asAdmin(request(app).post(`/api/admin/jobs/${jobId}/recommend`)).send({
    candidateProfileId: otherProfileId,
  });
  recommendedApplicationId = recommended.body.applicationId as string;

  // --- CANDIDATE_NOT_SELECTED -----------------------------------------------
  // Still an admin recommendation turned down by the employer — admin's
  // recommend action is unrelated to hiring-stage decisions and untouched by
  // this product change, but the actual rejection is the employer's own, as
  // it already was before.
  applicationService.changeStage({
    applicationId: recommendedApplicationId,
    toStage: 'NOT_SELECTED',
    role: 'EMPLOYER',
    actorId: employerUserId,
    note: 'Not the right fit for this brief.',
  });

  // Referenced so the linter sees the seeded ids as used by the suite.
  void jobRepo;
});

afterAll(async () => {
  // Every notify() call this file triggered — not just the ones individual
  // tests explicitly awaited — defers its email/WhatsApp dispatch via
  // setImmediate (see lib/notify.ts). Closing the database before those
  // settle would make a stray late write throw against a closed connection.
  const { notificationDispatchSettled } = await import('../src/lib/notify.js');
  await notificationDispatchSettled();
  ctx.cleanup();
});

// ---------------------------------------------------------------------------
// The matrix, row by row
// ---------------------------------------------------------------------------

/**
 * Rows whose full declared recipient set is no longer reachable by ANY
 * journey, now that interview coordination and hiring decisions moved from
 * Admin to Candidate/Employer.
 *
 * CANDIDATE_SHORTLISTED's EMPLOYER recipient existed for the case where BK
 * shortlisted on the employer's behalf (a third-party actor, so the employer
 * was not excluded). That path is gone — the employer is now always the one
 * who shortlists, so excludeUserId always strips them. The matrix row is
 * left exactly as transcribed from the proposal (this file's own header
 * comment: transcribed, not paraphrased) rather than silently edited to match
 * the new reality; this is reported as a known consequence instead.
 */
const PARTIALLY_UNREACHABLE_NOW: ReadonlySet<NotificationEvent> = new Set(['CANDIDATE_SHORTLISTED']);

/**
 * INTERVIEW_REMINDER is the one matrix row with no Portal channel at all
 * (see NOTIFICATION_MATRIX) — notify() deliberately writes zero rows to the
 * `notification` table for it, so `deliveredOf()` (which only reads that
 * table) can never see it delivered, by design, not by a journey gap. It
 * gets its own describe block below instead, asserting against
 * `notification_delivery` (the email/WhatsApp audit trail).
 */
const PORTAL_LESS: ReadonlySet<NotificationEvent> = new Set(['INTERVIEW_REMINDER']);

describe('the p8 notification matrix', () => {
  it.each(NOTIFICATION_MATRIX.filter((spec) => !PORTAL_LESS.has(spec.event)))(
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
      if (PARTIALLY_UNREACHABLE_NOW.has(event)) {
        for (const role of gotRoles) expect(recipients).toContain(role);
      } else {
        expect(gotRoles).toEqual([...recipients].sort());
      }
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
// Email / WhatsApp channel dispatch (lib/channels.ts, lib/notify.ts)
// ---------------------------------------------------------------------------

describe('email/WhatsApp channel dispatch', () => {
  it('dispatches on every channel the event declares, skipping gracefully when a recipient has no mobile number', async () => {
    const { notificationDispatchSettled } = await import('../src/lib/notify.js');
    const deliveryRepo = await import('../src/repositories/notification-delivery.repo.js');
    await notificationDispatchSettled();

    // CANDIDATE_PROFILE_APPROVED: Email + WhatsApp + Portal, candidate only —
    // the candidate has both an email and a mobile on file, so both channels
    // should have actually attempted a send (through the logging transport).
    const approved = deliveryRepo
      .listForUser(candidateUserId)
      .filter((d) => d.event === 'CANDIDATE_PROFILE_APPROVED');
    expect(approved.map((d) => d.channel).sort()).toEqual(['EMAIL', 'WHATSAPP']);
    expect(approved.every((d) => d.status === 'SENT')).toBe(true);

    // APPLICATION_SUBMITTED reaches ADMIN too, and no admin has a mobile
    // number anywhere in this product — that must be a SKIPPED delivery, not
    // a FAILED one; skipping a channel that genuinely does not apply is not
    // an error.
    const adminWhatsapp = deliveryRepo
      .listForUser(adminId)
      .find((d) => d.event === 'APPLICATION_SUBMITTED' && d.channel === 'WHATSAPP');
    expect(adminWhatsapp?.status).toBe('SKIPPED');

    // JOB_SUBMITTED is Email + Portal only in the matrix — no WhatsApp
    // dispatch should be attempted for it at all, SKIPPED or otherwise.
    const jobSubmittedWhatsapp = deliveryRepo
      .listForUser(employerUserId)
      .filter((d) => d.event === 'JOB_SUBMITTED' && d.channel === 'WHATSAPP');
    expect(jobSubmittedWhatsapp).toHaveLength(0);
  });

  it('records a FAILED delivery, not a thrown error, when the transport rejects', async () => {
    const channels = await import('../src/lib/channels.js');
    const notifyLib = await import('../src/lib/notify.js');
    const deliveryRepo = await import('../src/repositories/notification-delivery.repo.js');

    channels.setTransportsForTesting({
      email: {
        send: async () => {
          throw new Error('provider unreachable');
        },
      },
    });

    // notify() itself must never throw because a downstream channel failed —
    // the portal row (and the fact being recorded in application state) must
    // never depend on email/WhatsApp succeeding.
    expect(() =>
      notifyLib.notify({
        event: 'CANDIDATE_SHORTLISTED',
        parties: { CANDIDATE: candidateUserId, EMPLOYER: employerUserId },
        title: 'Channel-failure-path test',
        entityType: 'APPLICATION',
        entityId: 'channel-failure-path-test',
      }),
    ).not.toThrow();

    await notifyLib.notificationDispatchSettled();

    const failed = deliveryRepo
      .listForUser(candidateUserId)
      .find((d) => d.event === 'CANDIDATE_SHORTLISTED' && d.channel === 'EMAIL');
    expect(failed?.status).toBe('FAILED');
    expect(failed?.detail).toContain('provider unreachable');

    channels.setTransportsForTesting(); // restore the logging default
  });
});

// ---------------------------------------------------------------------------
// The 24-hour-before interview reminder (lib/interview-reminder-sweep.ts)
// ---------------------------------------------------------------------------

describe('the 24-hour interview reminder', () => {
  it('reminds once per interview on Email + WhatsApp only (no portal row), and is idempotent across repeated sweeps', async () => {
    const jobRepo = await import('../src/repositories/job.repo.js');
    const employerRepo = await import('../src/repositories/employer.repo.js');
    const recommendationService = await import('../src/modules/admin/recommendation.service.js');
    const { runInterviewReminderSweep } = await import('../src/lib/interview-reminder-sweep.js');
    const { notificationDispatchSettled } = await import('../src/lib/notify.js');
    const deliveryRepo = await import('../src/repositories/notification-delivery.repo.js');
    const { getDb } = await import('../src/db/client.js');

    const employerProfileId = employerRepo.findByUserId(employerUserId)!.id;
    const jobId = jobRepo.create(employerProfileId, 'Instrumentation Engineer');
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

    // Inside the 24-hour window — must be reminded by the next sweep.
    recommendationService.scheduleInterview({
      applicationId,
      scheduledAt: inHours(20),
      durationMinutes: 30,
      mode: 'VIDEO',
      locationOrLink: 'https://meet.example.com/reminder-test',
      actorId: employerUserId,
      role: 'EMPLOYER',
    });
    const interview = getDb()
      .prepare("SELECT id FROM interview WHERE application_id = ? AND status = 'SCHEDULED'")
      .get(applicationId) as { id: string };

    const first = runInterviewReminderSweep();
    expect(first.remindedCount).toBeGreaterThanOrEqual(1);
    await notificationDispatchSettled();

    // No portal row — the one matrix row with no Portal channel.
    const portalRows = getDb()
      .prepare("SELECT 1 FROM notification WHERE event = 'INTERVIEW_REMINDER' AND entity_id = ?")
      .all(interview.id);
    expect(portalRows).toHaveLength(0);

    const candidateDeliveries = deliveryRepo
      .listForUser(candidateUserId)
      .filter((d) => d.event === 'INTERVIEW_REMINDER');
    expect(candidateDeliveries.map((d) => d.channel).sort()).toEqual(['EMAIL', 'WHATSAPP']);
    expect(candidateDeliveries.every((d) => d.status === 'SENT')).toBe(true);

    const employerDeliveries = deliveryRepo
      .listForUser(employerUserId)
      .filter((d) => d.event === 'INTERVIEW_REMINDER');
    expect(employerDeliveries.map((d) => d.channel).sort()).toEqual(['EMAIL', 'WHATSAPP']);

    // Idempotency: reminder_sent_at is now set, so a second sweep — even one
    // covering the exact same window — must claim nothing more for this
    // interview. This is the duplicate-prevention guarantee: a candidate
    // must never get two reminder messages for the same interview no matter
    // how many times the interval fires before the interview happens.
    const before = deliveryRepo.listForUser(candidateUserId).filter((d) => d.event === 'INTERVIEW_REMINDER').length;
    runInterviewReminderSweep();
    await notificationDispatchSettled();
    const after = deliveryRepo.listForUser(candidateUserId).filter((d) => d.event === 'INTERVIEW_REMINDER').length;
    expect(after).toBe(before);

    const row = getDb()
      .prepare('SELECT reminder_sent_at FROM interview WHERE id = ?')
      .get(interview.id) as { reminder_sent_at: string | null };
    expect(row.reminder_sent_at).not.toBeNull();
  });

  it('does not remind an interview more than 24 hours out', async () => {
    const jobRepo = await import('../src/repositories/job.repo.js');
    const employerRepo = await import('../src/repositories/employer.repo.js');
    const recommendationService = await import('../src/modules/admin/recommendation.service.js');
    const { runInterviewReminderSweep } = await import('../src/lib/interview-reminder-sweep.js');
    const { getDb } = await import('../src/db/client.js');

    const employerProfileId = employerRepo.findByUserId(employerUserId)!.id;
    const jobId = jobRepo.create(employerProfileId, 'Quality Engineer — Future Interview');
    jobRepo.setStatus(jobId, 'APPROVED', ['DRAFT'], { publishedAt: new Date().toISOString() });

    const applied = await request(app)
      .post(`/api/candidate/jobs/${jobId}/apply`)
      .set('Cookie', candidateCookie)
      .set(CSRF_HEADER);
    const applicationId = applied.body.applicationId as string;

    for (const stage of ['UNDER_REVIEW', 'SHORTLISTED']) {
      await request(app)
        .post(`/api/employer/applications/${applicationId}/stage`)
        .set('Cookie', employerCookie)
        .set(CSRF_HEADER)
        .send({ stage });
    }

    recommendationService.scheduleInterview({
      applicationId,
      scheduledAt: inHours(70), // well outside the 24-hour window
      durationMinutes: 30,
      mode: 'VIDEO',
      locationOrLink: 'https://meet.example.com/far-out-test',
      actorId: employerUserId,
      role: 'EMPLOYER',
    });
    const interview = getDb()
      .prepare("SELECT id FROM interview WHERE application_id = ? AND status = 'SCHEDULED'")
      .get(applicationId) as { id: string };

    runInterviewReminderSweep();

    const row = getDb()
      .prepare('SELECT reminder_sent_at FROM interview WHERE id = ?')
      .get(interview.id) as { reminder_sent_at: string | null };
    expect(row.reminder_sent_at).toBeNull();
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
    const when = formatDateTime(interviewScheduledAt);
    // Scoped to this specific interview's time — a second application in the
    // same journey (the decline-path fixture) also schedules one, at a
    // different time, and would otherwise double-count here.
    const delivered = deliveredOf('INTERVIEW_CONFIRMED').filter((d) => d.body?.includes(when));

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
