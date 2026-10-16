/**
 * P8 — the DPDP right to erasure.
 *
 * Asserted column by column against the database rather than through the API,
 * because the API is exactly what an erasure is supposed to make unable to see
 * this person. "The profile endpoint 404s now" is satisfied by a soft delete,
 * which is not erasure at all.
 *
 * The other half of the test is what must SURVIVE: an employer's record of who
 * they interviewed, and the audit trail. Erasure that takes those with it is
 * not compliance, it is data loss with a compliance story attached.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import request from 'supertest';
import type { Express } from 'express';
import { createTestContext, CSRF_HEADER, sessionCookie, type TestContext } from './helpers/test-app.js';

let ctx: TestContext;
let app: Express;

let adminCookie: string;
let candidateCookie: string;
let employerCookie: string;
let candidateUserId: string;
let candidateProfileId: string;
let applicationId: string;
let resumePath: string;
let requestId: string;

const MOBILE = '9811122233';
const EMAIL = 'erase-me@example.com';
const FULL_NAME = 'Rohan Kulkarni';
const CURRENT_SALARY = 1_450_000;

const PDF = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(512, 0x20)]);

beforeAll(async () => {
  ctx = await createTestContext('erasure');
  app = ctx.app;

  const { getDb } = await import('../src/db/client.js');
  const userRepo = await import('../src/repositories/user.repo.js');
  const candidateRepo = await import('../src/repositories/candidate.repo.js');
  const employerRepo = await import('../src/repositories/employer.repo.js');
  const jobRepo = await import('../src/repositories/job.repo.js');
  const { hashPassword } = await import('../src/lib/password.js');
  const applicationService = await import('../src/modules/application/application.service.js');
  const recommendationService = await import('../src/modules/admin/recommendation.service.js');

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
    fullName: FULL_NAME,
    email: EMAIL,
    mobile: MOBILE,
    password: 'correct-horse-1',
    consentToShare: true,
  });
  candidateCookie = sessionCookie(candidate);

  const me = await request(app).get('/api/auth/me').set('Cookie', candidateCookie);
  candidateUserId = me.body.id;
  candidateProfileId = candidateRepo.findByUserId(candidateUserId)!.id;

  await request(app)
    .post('/api/candidate/resume')
    .set('Cookie', candidateCookie)
    .set(CSRF_HEADER)
    .attach('resume', PDF, 'rohan.pdf');

  const fileRow = getDb()
    .prepare('SELECT stored_path FROM file_asset WHERE owner_id = ?')
    .get(candidateUserId) as { stored_path: string };
  const fileStorage = await import('../src/lib/file-storage.js');
  resumePath = fileStorage.absolutePathOf(fileRow.stored_path);
  expect(fs.existsSync(resumePath)).toBe(true);

  candidateRepo.updateFields(candidateProfileId, {
    current_salary: CURRENT_SALARY,
    career_summary: 'Fifteen years in rotating equipment across two refineries.',
    current_employer: 'Bharat Petroleum',
    linkedin_url: 'https://linkedin.com/in/rohan-example',
  });
  candidateRepo.replaceExperiences(candidateProfileId, [
    {
      company: 'Bharat Petroleum',
      title: 'Reliability Engineer',
      startYear: 2015,
      endYear: null,
      isCurrent: true,
      keyAchievement: 'Cut unplanned downtime by a third.',
      sortOrder: 0,
    },
  ]);
  candidateRepo.setStatus(candidateProfileId, 'APPROVED');

  // An employer with a live application, so we can prove their record survives.
  const employer = await request(app).post('/api/auth/register/employer').set(CSRF_HEADER).send({
    companyName: 'Praj Industries',
    hrContactName: 'Kavita Rao',
    email: 'kavita@praj.example.com',
    hrContactPhone: '9876500000',
    password: 'correct-horse-2',
  });
  employerCookie = sessionCookie(employer);
  const employerMe = await request(app).get('/api/auth/me').set('Cookie', employerCookie);
  const employerUserId: string = employerMe.body.id;
  const employerProfileId = employerRepo.findByUserId(employerMe.body.id)!.id;
  getDb()
    .prepare("UPDATE employer_profile SET account_status='APPROVED' WHERE id=?")
    .run(employerProfileId);

  const jobId = jobRepo.create(employerProfileId, 'Rotating Equipment Lead');
  jobRepo.setStatus(jobId, 'APPROVED', ['DRAFT'], { publishedAt: new Date().toISOString() });

  const applied = await request(app)
    .post(`/api/candidate/jobs/${jobId}/apply`)
    .set('Cookie', candidateCookie)
    .set(CSRF_HEADER);
  applicationId = applied.body.applicationId;

  /*
   * Everything OTHER people write about this person.
   *
   * Every one of these is a place a real leak was found: prose typed by an
   * admin or an employer, stored on a row that does not belong to the erased
   * user and is therefore invisible to any query scoped by their id.
   */
  await request(app)
    .post('/api/admin/notes')
    .set('Cookie', adminCookie)
    .set(CSRF_HEADER)
    .send({ entityType: 'CANDIDATE', entityId: candidateProfileId, body: 'Spoke on the 3rd.' });

  // A note against the APPLICATION, not the candidate — the one that survived.
  await request(app)
    .post('/api/admin/notes')
    .set('Cookie', adminCookie)
    .set(CSRF_HEADER)
    .send({
      entityType: 'APPLICATION',
      entityId: applicationId,
      body: `${FULL_NAME} asked for 30 LPA, reachable on ${MOBILE}.`,
    });

  // The employer asks to meet them, in their own words.
  const reqRes = await request(app)
    .post(`/api/employer/applications/${applicationId}/request-interview`)
    .set('Cookie', employerCookie)
    .set(CSRF_HEADER)
    .send({ preferredSlots: [], note: `Please arrange ${FULL_NAME}, ${EMAIL}.` });
  expect(reqRes.status, JSON.stringify(reqRes.body)).toBe(201);

  // Shortlist, then book it with joining instructions naming them.
  //
  // Admin no longer has an HTTP route to do either (see admin-pipeline.routes.ts
  // and admin-coordination.routes.ts) — that mutation authority was removed as
  // a product decision. This test is not about that authority; it is about
  // what erasure must and must not touch, so state is seeded through the
  // service layer directly, the same domain logic the removed routes used.
  applicationService.changeStage({
    applicationId,
    toStage: 'UNDER_REVIEW',
    role: 'EMPLOYER',
    actorId: employerUserId,
  });
  applicationService.changeStage({
    applicationId,
    toStage: 'SHORTLISTED',
    role: 'EMPLOYER',
    actorId: employerUserId,
    note: `${FULL_NAME} confirmed by phone on ${MOBILE}.`,
  });

  const ivRes = recommendationService.scheduleInterview({
    applicationId,
    scheduledAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    durationMinutes: 45,
    mode: 'ONSITE',
    locationOrLink: 'Gate 2, Chakan MIDC',
    instructions: `Ask for ${FULL_NAME} at reception; his mobile is ${MOBILE}.`,
    actorId: employerUserId,
    role: 'EMPLOYER',
  });
  expect(ivRes.interviewId).toBeTruthy();
});

afterAll(() => ctx.cleanup());

async function db() {
  const { getDb } = await import('../src/db/client.js');
  return getDb();
}

// ---------------------------------------------------------------------------
// Requesting
// ---------------------------------------------------------------------------

describe('asking to be erased', () => {
  it('records the request without erasing anything yet', async () => {
    const res = await request(app)
      .post('/api/privacy/erasure-requests')
      .set('Cookie', candidateCookie)
      .set(CSRF_HEADER)
      .send({
        // People routinely identify themselves in this field. It is stored,
        // and it used to survive the erasure it asked for.
        reason: `Please delete everything. I am ${FULL_NAME}, mobile ${MOBILE}.`,
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('OPEN');
    requestId = res.body.id;

    // Still fully present — an erasure is a decision, not a side effect of
    // asking for one.
    const profile = (await db())
      .prepare('SELECT full_name, mobile FROM candidate_profile WHERE id = ?')
      .get(candidateProfileId) as { full_name: string; mobile: string };
    expect(profile.full_name).toBe('Rohan Kulkarni');
    expect(profile.mobile).toBe(MOBILE);
  });

  it('refuses a second open request', async () => {
    const res = await request(app)
      .post('/api/privacy/erasure-requests')
      .set('Cookie', candidateCookie)
      .set(CSRF_HEADER)
      .send({});
    expect(res.status).toBe(409);
  });

  it('is not something one user can file for another', async () => {
    // There is no user id in the route at all — the only account a caller can
    // ask about is the one their session belongs to.
    const res = await request(app)
      .get('/api/privacy/erasure-requests')
      .set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(0);
  });

  it('is only executable by an admin', async () => {
    const res = await request(app)
      .post(`/api/admin/erasure-requests/${requestId}/execute`)
      .set('Cookie', candidateCookie)
      .set(CSRF_HEADER);
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Executing
// ---------------------------------------------------------------------------

/**
 * Sweeps EVERY text column of EVERY table for a set of needles.
 *
 * This is the assertion that matters, and its absence is why seven separate
 * leaks shipped: the original suite named twelve specific columns and checked
 * each was null, which confirms the list rather than the database. Anything
 * the list forgot — an interview instruction, a note on the application rather
 * than the candidate, a notification sitting in someone else's bell — passed
 * silently.
 *
 * Reading the column list from PRAGMA rather than hard-coding it means a table
 * added in a future migration is searched automatically.
 */
async function findNeedlesInDatabase(needles: readonly string[]): Promise<string[]> {
  const conn = await db();
  const hits: string[] = [];

  const tables = conn
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all() as { name: string }[];

  for (const { name: table } of tables) {
    const columns = conn.prepare(`PRAGMA table_info(${table})`).all() as {
      name: string;
      type: string;
    }[];

    for (const column of columns) {
      // TEXT covers every free-text and identifier column in this schema.
      if (!/TEXT/i.test(column.type)) continue;

      for (const needle of needles) {
        const found = conn
          .prepare(
            `SELECT "${column.name}" AS v FROM "${table}" WHERE "${column.name}" LIKE ? LIMIT 1`,
          )
          .get(`%${needle}%`) as { v: string } | undefined;

        if (found) hits.push(`${table}.${column.name} = ${JSON.stringify(found.v)}`);
      }
    }
  }

  return hits;
}

describe('carrying the erasure out', () => {
  it('completes', async () => {
    const res = await request(app)
      .post(`/api/admin/erasure-requests/${requestId}/execute`)
      .set('Cookie', adminCookie)
      .set(CSRF_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.filesRemoved).toBe(1);
  });

  it('leaves no identifying value on the candidate profile', async () => {
    const row = (await db())
      .prepare('SELECT * FROM candidate_profile WHERE id = ?')
      .get(candidateProfileId) as Record<string, unknown>;

    // Named individually rather than looped, so adding a personal column to
    // the schema without adding it to the erasure is a failing test here.
    expect(row.full_name).not.toContain('Rohan');
    expect(row.mobile).toBe('');
    expect(row.current_salary).toBeNull();
    expect(row.expected_salary_min).toBeNull();
    expect(row.expected_salary_max).toBeNull();
    expect(row.career_summary).toBeNull();
    expect(row.current_employer).toBeNull();
    expect(row.current_job_title).toBeNull();
    expect(row.linkedin_url).toBeNull();
    expect(row.resume_file_id).toBeNull();
    expect(row.last_approved_snapshot).toBeNull();
    expect(row.deleted_at).not.toBeNull();

    // And nothing anywhere in the row still spells their name or number.
    const serialised = JSON.stringify(row);
    expect(serialised).not.toContain('Rohan');
    expect(serialised).not.toContain(MOBILE);
    expect(serialised).not.toContain(String(CURRENT_SALARY));
  });

  it('leaves no identifying value on the user row', async () => {
    const row = (await db())
      .prepare('SELECT * FROM user WHERE id = ?')
      .get(candidateUserId) as Record<string, unknown>;

    expect(row.email).not.toBe(EMAIL);
    expect(String(row.email)).toContain('@erased.invalid');
    expect(row.password_hash).toBe('ERASED');
    expect(row.deleted_at).not.toBeNull();
  });

  it('leaves the subject’s name, mobile and email nowhere in the database', async () => {
    /*
     * The assertion that matters.
     *
     * Not a list of columns to check — a search of every text column in every
     * table for the things that identify this person. The previous version of
     * this suite named twelve columns and passed while seven others still held
     * the subject's full name and phone number, several of them still being
     * served to employers and admins through live endpoints.
     *
     * If this fails, read the hit list: it names the exact table.column that
     * the erasure forgot.
     */
    const hits = await findNeedlesInDatabase([FULL_NAME, MOBILE, EMAIL]);
    expect(hits, `personal data survived the erasure:\n  ${hits.join('\n  ')}`).toEqual([]);
  });

  it('removes the CV from disk, not just from the database', () => {
    // The one that a soft delete quietly fails. A CV sitting in uploads/ after
    // an erasure is still personal data we are holding.
    expect(fs.existsSync(resumePath)).toBe(false);
  });

  it('removes skills, career history, notes and notifications', async () => {
    const conn = await db();
    const count = (sql: string, param: string) =>
      (conn.prepare(sql).get(param) as { n: number }).n;

    expect(
      count('SELECT COUNT(*) AS n FROM candidate_experience WHERE candidate_profile_id = ?', candidateProfileId),
    ).toBe(0);
    expect(
      count('SELECT COUNT(*) AS n FROM candidate_skill WHERE candidate_profile_id = ?', candidateProfileId),
    ).toBe(0);
    expect(
      count(
        "SELECT COUNT(*) AS n FROM admin_note WHERE entity_type = 'CANDIDATE' AND entity_id = ?",
        candidateProfileId,
      ),
    ).toBe(0);
    expect(count('SELECT COUNT(*) AS n FROM notification WHERE user_id = ?', candidateUserId)).toBe(0);
    expect(count('SELECT COUNT(*) AS n FROM file_asset WHERE owner_id = ?', candidateUserId)).toBe(0);
    expect(count('SELECT COUNT(*) AS n FROM session WHERE user_id = ?', candidateUserId)).toBe(0);
  });

  it('ends their sessions immediately', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', candidateCookie);
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// What has to survive
// ---------------------------------------------------------------------------

describe('what survives an erasure', () => {
  it('keeps the application and its history', async () => {
    const conn = await db();

    const application = conn
      .prepare('SELECT * FROM application WHERE id = ?')
      .get(applicationId) as Record<string, unknown> | undefined;
    expect(application).toBeTruthy();

    const events = conn
      .prepare('SELECT * FROM application_stage_event WHERE application_id = ?')
      .all(applicationId) as { changed_by_id: string | null }[];
    expect(events.length).toBeGreaterThan(0);

    // Detached from the person, not deleted with them: the employer's record
    // of the process keeps its shape and loses its actor.
    for (const event of events) {
      expect(event.changed_by_id).not.toBe(candidateUserId);
    }
  });

  it('keeps the audit trail, without the actor', async () => {
    const conn = await db();
    const rows = conn
      .prepare('SELECT COUNT(*) AS n FROM audit_log WHERE actor_id = ?')
      .get(candidateUserId) as { n: number };
    expect(rows.n).toBe(0);

    // The erasure itself is auditable — that record is the only evidence we
    // complied, so it is written against the request, not the person.
    const erasureAudit = conn
      .prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'USER_ERASED'")
      .get() as { n: number };
    expect(erasureAudit.n).toBe(1);
  });

  it('keeps the request itself, marked done', async () => {
    const res = await request(app)
      .get('/api/admin/erasure-requests?status=COMPLETED')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].handledAt).not.toBeNull();
  });

  it('will not erase the same request twice', async () => {
    const res = await request(app)
      .post(`/api/admin/erasure-requests/${requestId}/execute`)
      .set('Cookie', adminCookie)
      .set(CSRF_HEADER);
    expect(res.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// Refusals and retention
// ---------------------------------------------------------------------------

describe('refusing and sweeping', () => {
  it('will not erase an admin through this route', async () => {
    const userRepo = await import('../src/repositories/user.repo.js');
    const erasureRepo = await import('../src/repositories/erasure.repo.js');
    const { hashPassword } = await import('../src/lib/password.js');

    const victimId = userRepo.create({
      email: 'second-admin@bktc.test',
      passwordHash: await hashPassword('admin-password-2'),
      role: 'ADMIN',
    });
    const id = erasureRepo.createRequest(victimId, undefined);

    const res = await request(app)
      .post(`/api/admin/erasure-requests/${id}/execute`)
      .set('Cookie', adminCookie)
      .set(CSRF_HEADER);

    expect(res.status).toBe(403);
    // Untouched.
    expect(userRepo.findById(victimId)!.email).toBe('second-admin@bktc.test');
  });

  it('requires an explanation to refuse a request', async () => {
    const erasureRepo = await import('../src/repositories/erasure.repo.js');
    const userRepo = await import('../src/repositories/user.repo.js');
    const { hashPassword } = await import('../src/lib/password.js');

    const someone = userRepo.create({
      email: 'refuse-me@example.com',
      passwordHash: await hashPassword('correct-horse-9'),
      role: 'CANDIDATE',
    });
    const id = erasureRepo.createRequest(someone, undefined);

    const bare = await request(app)
      .post(`/api/admin/erasure-requests/${id}/reject`)
      .set('Cookie', adminCookie)
      .set(CSRF_HEADER)
      .send({ note: 'no' });
    expect(bare.status).toBe(400);

    const explained = await request(app)
      .post(`/api/admin/erasure-requests/${id}/reject`)
      .set('Cookie', adminCookie)
      .set(CSRF_HEADER)
      .send({ note: 'An offer is live with an employer; we will erase once it closes.' });
    expect(explained.status).toBe(200);
  });

  it('sweeps sessions past the retention window', async () => {
    const conn = await db();
    const { runRetentionSweep, SESSION_RETENTION_DAYS } = await import(
      '../src/modules/privacy/retention.js'
    );

    const old = new Date(
      Date.now() - (SESSION_RETENTION_DAYS + 1) * 24 * 60 * 60 * 1000,
    ).toISOString();
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    conn
      .prepare(
        `INSERT INTO session (id, token_hash, user_id, expires_at, ip_address, user_agent, created_at)
         VALUES ('old-session', 'hash-old', ?, ?, '203.0.113.9', 'curl', ?)`,
      )
      .run(candidateUserId, future, old);

    const before = (
      conn.prepare("SELECT COUNT(*) AS n FROM session WHERE id = 'old-session'").get() as {
        n: number;
      }
    ).n;
    expect(before).toBe(1);

    const result = runRetentionSweep();
    expect(result.sessionsRemoved).toBeGreaterThanOrEqual(1);

    // The IP and user agent go with it — both are personal data with no
    // remaining purpose once the session is this old.
    const after = (
      conn.prepare("SELECT COUNT(*) AS n FROM session WHERE id = 'old-session'").get() as {
        n: number;
      }
    ).n;
    expect(after).toBe(0);
  });

  it('sweeps notes whose subject no longer exists', async () => {
    const conn = await db();
    const interviewRepo = await import('../src/repositories/interview.repo.js');
    const userRepo = await import('../src/repositories/user.repo.js');

    const admin = userRepo.findByEmail('admin@bktc.test')!;
    interviewRepo.createNote({
      authorId: admin.id,
      entityType: 'CANDIDATE',
      entityId: 'no-such-profile',
      body: 'Orphan.',
    });

    const { runRetentionSweep } = await import('../src/modules/privacy/retention.js');
    runRetentionSweep();

    const left = (
      conn
        .prepare("SELECT COUNT(*) AS n FROM admin_note WHERE entity_id = 'no-such-profile'")
        .get() as { n: number }
    ).n;
    expect(left).toBe(0);
  });
});
