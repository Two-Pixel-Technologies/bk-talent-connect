/**
 * P8 — the privacy suite.
 *
 * The plan's exit criterion is that this suite *bites when deliberately
 * broken*, so these tests are written against raw response bodies rather than
 * against serializer functions. A test that calls toEmployerCandidateView()
 * and checks the result has no salary passes happily while a route returns the
 * row directly; a test that reads the JSON an employer actually receives does
 * not.
 *
 * Four boundaries are asserted here:
 *
 *   1. Candidate salary never leaves the admin.
 *   2. A job's salary band reaches the owning employer and the admin only.
 *   3. Employers never receive a candidate's email or mobile.
 *   4. Ordering cannot be used to read a field the body hides.
 *
 * Plus the DPDP erasure, column by column, and a grep of the log output for a
 * known candidate's salary and mobile.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestContext, CSRF_HEADER, sessionCookie, type TestContext } from './helpers/test-app.js';

let ctx: TestContext;
let app: Express;

let adminCookie: string;
let candidateCookie: string;
let employerCookie: string;
let otherEmployerCookie: string;

let candidateUserId: string;
let candidateProfileId: string;
let jobId: string;
let applicationId: string;
let resumeFileId: string;

/** Distinctive values, so a leak is unambiguous when it is grepped for. */
const CURRENT_SALARY = 1_337_000;
const EXPECTED_MIN = 1_800_000;
const EXPECTED_MAX = 2_200_000;
const BAND_MIN = 2_000_000;
const BAND_MAX = 2_600_000;
const MOBILE = '9812345678';
const EMAIL = 'privacy-subject@example.com';

const PDF = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(512, 0x20)]);

/**
 * Everything the protected numbers could look like in a response body.
 *
 * Deliberately no bare two-digit values. `'18'` and `'22'` — the LPA forms of
 * the expected range — were in this list, and they match by pure chance inside
 * ULIDs and ISO timestamps: `"appliedAt":"2026-08-07T09:58:11.180Z"` contains
 * "18". That made the flagship privacy assertion fail on roughly a third of
 * runs for no reason, which is worse than not having it: a suite that is
 * randomly red teaches people to re-run until it goes green, and then a real
 * failure looks like the usual noise.
 *
 * The distinctive full values still catch a genuine leak; the ambiguous short
 * ones are covered by the key-name check below instead.
 */
const SALARY_FINGERPRINTS = [
  String(CURRENT_SALARY),
  String(EXPECTED_MIN),
  String(EXPECTED_MAX),
  '13.37',
  'currentSalary',
  'expectedSalary',
  // NOT 'salaryBand' — the applicant list embeds the employer's OWN job, and
  // the band on it is legitimately theirs. That boundary is asserted in its
  // own block below, against the candidate and a different employer.
];

beforeAll(async () => {
  ctx = await createTestContext('privacy', { captureLogs: true });
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
    fullName: 'Priya Nair',
    email: EMAIL,
    mobile: MOBILE,
    password: 'correct-horse-1',
    consentToShare: true,
  });
  candidateCookie = sessionCookie(candidate);

  const me = await request(app).get('/api/auth/me').set('Cookie', candidateCookie);
  candidateUserId = me.body.id;
  candidateProfileId = candidateRepo.findByUserId(candidateUserId)!.id;

  const upload = await request(app)
    .post('/api/candidate/resume')
    .set('Cookie', candidateCookie)
    .set(CSRF_HEADER)
    .attach('resume', PDF, 'priya.pdf');
  resumeFileId = upload.body.fileId ?? candidateRepo.findById(candidateProfileId)!.resume_file_id!;

  candidateRepo.updateFields(candidateProfileId, {
    current_salary: CURRENT_SALARY,
    expected_salary_min: EXPECTED_MIN,
    expected_salary_max: EXPECTED_MAX,
    current_job_title: 'Maintenance Engineer',
    years_of_experience: 8,
  });
  candidateRepo.setStatus(candidateProfileId, 'APPROVED');

  const employer = await request(app).post('/api/auth/register/employer').set(CSRF_HEADER).send({
    companyName: 'Thermax Works',
    hrContactName: 'Sunil Joshi',
    email: 'sunil@thermax.example.com',
    hrContactPhone: '9876500000',
    password: 'correct-horse-2',
  });
  employerCookie = sessionCookie(employer);
  const employerMe = await request(app).get('/api/auth/me').set('Cookie', employerCookie);
  const employerProfileId = employerRepo.findByUserId(employerMe.body.id)!.id;
  getDb()
    .prepare("UPDATE employer_profile SET account_status='APPROVED' WHERE id=?")
    .run(employerProfileId);

  const other = await request(app).post('/api/auth/register/employer').set(CSRF_HEADER).send({
    companyName: 'Rival Engineering',
    hrContactName: 'Meera Shah',
    email: 'meera@rival.example.com',
    hrContactPhone: '9876500001',
    password: 'correct-horse-3',
  });
  otherEmployerCookie = sessionCookie(other);
  const otherMe = await request(app).get('/api/auth/me').set('Cookie', otherEmployerCookie);
  getDb()
    .prepare("UPDATE employer_profile SET account_status='APPROVED' WHERE user_id=?")
    .run(otherMe.body.id);

  jobId = jobRepo.create(employerProfileId, 'Reliability Engineer');
  jobRepo.updateFields(jobId, { salary_band_min: BAND_MIN, salary_band_max: BAND_MAX });
  jobRepo.setStatus(jobId, 'APPROVED', ['DRAFT'], { publishedAt: new Date().toISOString() });

  const applied = await request(app)
    .post(`/api/candidate/jobs/${jobId}/apply`)
    .set('Cookie', candidateCookie)
    .set(CSRF_HEADER);
  applicationId = applied.body.applicationId;
});

afterAll(() => ctx.cleanup());

/** Asserts against the raw JSON text, not a parsed shape. */
function bodyText(res: { body: unknown }): string {
  return JSON.stringify(res.body);
}

// ---------------------------------------------------------------------------
// 1 & 3 — what an employer receives about a candidate
// ---------------------------------------------------------------------------

describe('the employer’s view of a candidate', () => {
  it('carries no salary, email or mobile anywhere in the payload', async () => {
    const res = await request(app)
      .get(`/api/employer/jobs/${jobId}/applications`)
      .set('Cookie', employerCookie);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(1);

    const text = bodyText(res);
    for (const fingerprint of SALARY_FINGERPRINTS) {
      expect(text, `employer payload contained ${fingerprint}`).not.toContain(fingerprint);
    }
    expect(text).not.toContain(MOBILE);
    expect(text).not.toContain(EMAIL);
  });

  it('carries no direct contact route of any kind', async () => {
    /*
     * The one the previous version of this suite missed.
     *
     * It checked for email and mobile by value, so a THIRD contact channel —
     * the candidate's LinkedIn URL — sat in the shared field set and reached
     * every employer from APPLIED onward. A LinkedIn profile is a working way
     * to contact someone directly, which is precisely what BK's fee exists to
     * prevent, and the candidate's own privacy page promised it did not happen.
     *
     * Asserted on KEY NAMES rather than values, because a leak is a leak
     * whether or not this particular fixture filled the field in.
     */
    const res = await request(app)
      .get(`/api/employer/jobs/${jobId}/applications`)
      .set('Cookie', employerCookie);

    const text = bodyText(res);
    for (const channel of ['linkedinUrl', 'mobile', 'email', 'phone', 'whatsapp']) {
      expect(text.toLowerCase(), `employer payload exposed ${channel}`).not.toContain(
        channel.toLowerCase(),
      );
    }
  });

  it('still gives the admin the contact routes they need', async () => {
    const res = await request(app)
      .get(`/api/admin/candidates/${candidateProfileId}`)
      .set('Cookie', adminCookie);
    expect(res.body.candidate).toHaveProperty('linkedinUrl');
    expect(res.body.candidate).toHaveProperty('mobile');
  });

  it('carries none of it on the single-application view either', async () => {
    const res = await request(app)
      .get(`/api/employer/applications/${applicationId}`)
      .set('Cookie', employerCookie);

    expect(res.status).toBe(200);
    const text = bodyText(res);
    expect(text).not.toContain(MOBILE);
    expect(text).not.toContain(EMAIL);
    expect(text).not.toContain(String(CURRENT_SALARY));
  });

  it('gives the admin exactly what the employer is denied', async () => {
    // The mirror image, and the reason the boundary is a serializer rather
    // than a column permission: the same row, two audiences.
    const res = await request(app)
      .get(`/api/admin/candidates/${candidateProfileId}`)
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    const text = bodyText(res);
    expect(text).toContain(MOBILE);
    expect(text).toContain(EMAIL);
    expect(res.body.candidate.currentSalaryLpa).toBe(CURRENT_SALARY / 100_000);
    expect(res.body.candidate.expectedSalaryMinLpa).toBe(EXPECTED_MIN / 100_000);
  });
});

// ---------------------------------------------------------------------------
// 2 — the job's salary band
// ---------------------------------------------------------------------------

describe('the salary band', () => {
  it('reaches the owning employer', async () => {
    const res = await request(app).get(`/api/employer/jobs/${jobId}`).set('Cookie', employerCookie);
    expect(res.status).toBe(200);
    expect(res.body.salaryBandMinLpa).toBe(BAND_MIN / 100_000);
  });

  it('does not reach the candidate', async () => {
    const res = await request(app)
      .get(`/api/candidate/jobs/${jobId}`)
      .set('Cookie', candidateCookie);

    expect(res.status).toBe(200);
    const text = bodyText(res);
    expect(text).not.toContain('salaryBand');
    expect(text).not.toContain(String(BAND_MIN));
    expect(text).not.toContain(String(BAND_MAX));
  });

  it('does not reach a different employer', async () => {
    const res = await request(app)
      .get(`/api/employer/jobs/${jobId}`)
      .set('Cookie', otherEmployerCookie);
    expect(res.status).toBe(403);
  });

  it('keeps the employer anonymous on the candidate’s view of a role', async () => {
    const res = await request(app)
      .get(`/api/candidate/jobs/${jobId}`)
      .set('Cookie', candidateCookie);
    expect(bodyText(res)).not.toContain('Thermax');
  });
});

// ---------------------------------------------------------------------------
// 4 — ordering as a side channel
// ---------------------------------------------------------------------------

describe('sort and filter allowlists', () => {
  it('rejects a sort on a field the serializer hides', async () => {
    /*
     * The subtle one. Serializers protect the response body and do nothing
     * about its order, so ?sort=expectedSalaryMin would let an employer rank
     * candidates by a number they cannot see — and binary-search the value by
     * combining it with filters.
     */
    const res = await request(app)
      .get(`/api/employer/jobs/${jobId}/applications?sort=expectedSalaryMin`)
      .set('Cookie', employerCookie);
    expect(res.status).toBe(400);
  });

  it('rejects an injected ORDER BY', async () => {
    const res = await request(app)
      .get(`/api/employer/jobs/${jobId}/applications?sort=${encodeURIComponent('name; DROP TABLE user')}`)
      .set('Cookie', employerCookie);
    expect(res.status).toBe(400);

    // Still there.
    const { getDb } = await import('../src/db/client.js');
    expect(getDb().prepare('SELECT COUNT(*) AS n FROM user').get()).toBeTruthy();
  });

  it('accepts the keys that are on the allowlist', async () => {
    for (const sort of ['applied', 'stage', 'name']) {
      const res = await request(app)
        .get(`/api/employer/jobs/${jobId}/applications?sort=${sort}`)
        .set('Cookie', employerCookie);
      expect(res.status, sort).toBe(200);
    }
  });
});

// ---------------------------------------------------------------------------
// IDOR sweep
// ---------------------------------------------------------------------------

describe('object references', () => {
  it('refuses another employer’s applicant list', async () => {
    const res = await request(app)
      .get(`/api/employer/jobs/${jobId}/applications`)
      .set('Cookie', otherEmployerCookie);
    expect(res.status).toBe(403);
  });

  it('refuses another employer’s application detail', async () => {
    const res = await request(app)
      .get(`/api/employer/applications/${applicationId}`)
      .set('Cookie', otherEmployerCookie);
    expect(res.status).toBe(403);
  });

  it('refuses a candidate’s CV to an employer with no application from them', async () => {
    const res = await request(app)
      .get(`/api/files/${resumeFileId}`)
      .set('Cookie', otherEmployerCookie);
    expect(res.status).toBe(403);
  });

  it('refuses admin endpoints to a candidate and to an employer', async () => {
    for (const [label, cookie] of [
      ['candidate', candidateCookie],
      ['employer', employerCookie],
    ] as const) {
      const res = await request(app).get('/api/admin/candidates').set('Cookie', cookie);
      expect(res.status, label).toBe(403);
    }
  });

  it('refuses an unauthenticated caller everywhere it matters', async () => {
    for (const path of [
      '/api/admin/candidates',
      '/api/candidate/applications',
      `/api/employer/jobs/${jobId}`,
      '/api/notifications',
      '/api/privacy/erasure-requests',
    ]) {
      const res = await request(app).get(path);
      expect(res.status, path).toBe(401);
    }
  });
});

// ---------------------------------------------------------------------------
// Log redaction
// ---------------------------------------------------------------------------

describe('the logs', () => {
  it('are actually being written', () => {
    // Guards the guard: with LOG_LEVEL silent the grep below would pass on an
    // empty string and prove nothing at all.
    expect(ctx.readLog().length).toBeGreaterThan(0);
  });

  it('never carry a candidate’s salary or mobile', async () => {
    /*
     * The plan's audit step is "grep the production logs for a known test
     * candidate's salary and mobile". The earlier audit only inspected
     * DevTools, which would have passed while the same values sat in
     * plaintext in the request log.
     */
    await request(app)
      .get(`/api/admin/candidates/${candidateProfileId}`)
      .set('Cookie', adminCookie);

    await request(app)
      .patch('/api/candidate/profile')
      .set('Cookie', candidateCookie)
      .set(CSRF_HEADER)
      .send({ mobile: MOBILE, currentSalaryLpa: CURRENT_SALARY / 100_000 });

    // Deliberately malformed: zod error messages echo the value that failed
    // validation, which is one of the three documented ways round the
    // serializer layer.
    await request(app)
      .patch('/api/candidate/profile')
      .set('Cookie', candidateCookie)
      .set(CSRF_HEADER)
      .send({ mobile: MOBILE, yearsOfExperience: 'not-a-number' });

    const captured = ctx.readLog();
    expect(captured).not.toContain(MOBILE);
    expect(captured).not.toContain(String(CURRENT_SALARY));
    expect(captured).not.toContain('correct-horse-1');
    expect(captured).not.toContain(EMAIL);
  });

  it('never carry a session cookie', () => {
    const captured = ctx.readLog();
    expect(captured).not.toContain('bktc_session=');
  });
});
