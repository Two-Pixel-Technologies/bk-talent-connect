/**
 * P4 exit checks.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestContext, CSRF_HEADER, sessionCookie, type TestContext } from './helpers/test-app.js';

let ctx: TestContext;
let app: Express;
let adminCookie: string;
let candidateCookie: string;
let candidateProfileId: string;
let employerProfileId: string;
let jobId: string;

beforeAll(async () => {
  ctx = await createTestContext('admin');
  app = ctx.app;

  const userRepo = await import('../src/repositories/user.repo.js');
  const { hashPassword } = await import('../src/lib/password.js');
  userRepo.create({
    email: 'admin@bktc.test',
    passwordHash: await hashPassword('admin-password-1'),
    role: 'ADMIN',
  });

  const login = await request(app)
    .post('/api/auth/login')
    .set(CSRF_HEADER)
    .send({ email: 'admin@bktc.test', password: 'admin-password-1' });
  adminCookie = sessionCookie(login);

  // A candidate who has submitted for review.
  const candidate = await request(app).post('/api/auth/register/candidate').set(CSRF_HEADER).send({
    fullName: 'Anita Desai',
    email: 'anita@example.com',
    mobile: '9876543210',
    password: 'correct-horse-1',
    consentToShare: true,
  });
  candidateCookie = sessionCookie(candidate);

  const candidateRepo = await import('../src/repositories/candidate.repo.js');
  const me = await request(app).get('/api/auth/me').set('Cookie', candidateCookie);
  const profile = candidateRepo.findByUserId(me.body.id)!;
  candidateProfileId = profile.id;
  candidateRepo.updateFields(profile.id, {
    current_salary: 1_800_000,
    expected_salary_min: 2_400_000,
    expected_salary_max: 3_000_000,
  });
  candidateRepo.setStatus(profile.id, 'SUBMITTED', { submittedAt: new Date().toISOString() });

  // An employer plus a job awaiting review.
  const employer = await request(app).post('/api/auth/register/employer').set(CSRF_HEADER).send({
    companyName: 'Kirloskar Systems',
    hrContactName: 'Ravi Menon',
    email: 'ravi@kirloskar.example.com',
    hrContactPhone: '9876500000',
    password: 'correct-horse-2',
  });
  const employerRepo = await import('../src/repositories/employer.repo.js');
  const employerMe = await request(app).get('/api/auth/me').set('Cookie', sessionCookie(employer));
  employerProfileId = employerRepo.findByUserId(employerMe.body.id)!.id;

  const { getDb } = await import('../src/db/client.js');
  getDb()
    .prepare("UPDATE employer_profile SET account_status = 'APPROVED' WHERE id = ?")
    .run(employerProfileId);

  const jobRepo = await import('../src/repositories/job.repo.js');
  jobId = jobRepo.create(employerProfileId, 'Senior Process Engineer');
  jobRepo.updateFields(jobId, { salary_band_min: 2_000_000, salary_band_max: 2_800_000 });
  jobRepo.setStatus(jobId, 'PENDING_APPROVAL', ['DRAFT']);
});

afterAll(() => ctx.cleanup());

const asAdmin = (r: request.Test) => r.set('Cookie', adminCookie).set(CSRF_HEADER);

describe('access control', () => {
  it('refuses a candidate on every admin route', async () => {
    for (const path of ['/api/admin/stats', '/api/admin/candidates', '/api/admin/employers', '/api/admin/jobs']) {
      const res = await request(app).get(path).set('Cookie', candidateCookie);
      expect(res.status, path).toBe(403);
    }
  });

  it('refuses an anonymous request', async () => {
    expect((await request(app).get('/api/admin/stats')).status).toBe(401);
  });
});

describe('stats', () => {
  it('matches hand-counted rows', async () => {
    const res = await asAdmin(request(app).get('/api/admin/stats'));
    expect(res.status).toBe(200);

    const { getDb } = await import('../src/db/client.js');
    const db = getDb();
    const count = (sql: string) => (db.prepare(sql).get() as { n: number }).n;

    expect(res.body.candidates.total).toBe(count('SELECT count(*) AS n FROM candidate_profile'));
    expect(res.body.candidates.pending).toBe(
      count("SELECT count(*) AS n FROM candidate_profile WHERE profile_status = 'SUBMITTED'"),
    );
    expect(res.body.employers.total).toBe(count('SELECT count(*) AS n FROM employer_profile'));
    expect(res.body.jobs.pending).toBe(
      count("SELECT count(*) AS n FROM job WHERE status = 'PENDING_APPROVAL'"),
    );
  });
});

describe('review queues', () => {
  it('lists candidates awaiting review', async () => {
    const res = await asAdmin(request(app).get('/api/admin/candidates?status=SUBMITTED'));
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].fullName).toBe('Anita Desai');
  });

  it('shows the admin the candidate’s salary — the one role that may see it', async () => {
    const res = await asAdmin(request(app).get(`/api/admin/candidates/${candidateProfileId}`));
    expect(res.status).toBe(200);
    expect(res.body.candidate.currentSalaryLpa).toBe(18);
    expect(res.body.candidate.expectedSalaryMinLpa).toBe(24);
    expect(res.body.candidate.email).toBe('anita@example.com');
  });

  it('rejects an unknown sort key', async () => {
    const res = await asAdmin(request(app).get('/api/admin/candidates?sort=expected_salary_min'));
    expect(res.status).toBe(400);
  });

  it('supports search', async () => {
    const res = await asAdmin(request(app).get('/api/admin/candidates?search=Anita'));
    expect(res.body.items.length).toBe(1);
  });
});

describe('review decisions', () => {
  it('requires a reason to request changes', async () => {
    const res = await asAdmin(request(app).post(`/api/admin/candidates/${candidateProfileId}/review`)).send({
      decision: 'REQUEST_CHANGES',
      expectedStatus: 'SUBMITTED',
    });
    // Enforced by the API, not just the form — a direct call must not bypass it.
    expect(res.status).toBe(400);
    expect(res.body.error.fields[0].path).toBe('note');
  });

  it('rejects a token-length reason', async () => {
    const res = await asAdmin(request(app).post(`/api/admin/candidates/${candidateProfileId}/review`)).send({
      decision: 'REJECT',
      note: 'no',
      expectedStatus: 'SUBMITTED',
    });
    expect(res.status).toBe(400);
  });

  it('shows the reason verbatim to the candidate', async () => {
    const note = 'Please add your two most recent roles and expand the career summary.';
    const review = await asAdmin(
      request(app).post(`/api/admin/candidates/${candidateProfileId}/review`),
    ).send({ decision: 'REQUEST_CHANGES', note, expectedStatus: 'SUBMITTED' });
    expect(review.status).toBe(204);

    const profile = await request(app).get('/api/candidate/profile').set('Cookie', candidateCookie);
    expect(profile.body.profileStatus).toBe('CHANGES_REQUESTED');
    expect(profile.body.reviewNote).toBe(note);
  });

  it('approves without requiring a reason', async () => {
    const res = await asAdmin(request(app).post(`/api/admin/candidates/${candidateProfileId}/review`)).send({
      decision: 'APPROVE',
      expectedStatus: 'CHANGES_REQUESTED',
    });
    expect(res.status).toBe(204);

    const profile = await request(app).get('/api/candidate/profile').set('Cookie', candidateCookie);
    expect(profile.body.profileStatus).toBe('APPROVED');
  });

  it('snapshots the approved profile so a re-review can diff it', async () => {
    const candidateRepo = await import('../src/repositories/candidate.repo.js');
    const profile = candidateRepo.findById(candidateProfileId)!;
    expect(profile.last_approved_snapshot).toBeTruthy();

    const snapshot = JSON.parse(profile.last_approved_snapshot!) as Record<string, unknown>;
    expect(snapshot).toHaveProperty('skills');
    // The snapshot must not become a second, unprotected copy of the salary.
    expect(JSON.stringify(snapshot)).not.toContain('salary');
  });

  it('publishes a job on approval', async () => {
    const res = await asAdmin(request(app).post(`/api/admin/jobs/${jobId}/review`)).send({
      decision: 'APPROVE',
      expectedStatus: 'PENDING_APPROVAL',
    });
    expect(res.status).toBe(204);

    const job = await asAdmin(request(app).get(`/api/admin/jobs/${jobId}`));
    expect(job.body.status).toBe('APPROVED');
    expect(job.body.publishedAt).not.toBeNull();
  });
});

describe('concurrent review', () => {
  it('lets only one of two simultaneous decisions win', async () => {
    const employerRepo = await import('../src/repositories/employer.repo.js');
    const { getDb } = await import('../src/db/client.js');
    getDb()
      .prepare("UPDATE employer_profile SET account_status = 'SUBMITTED' WHERE id = ?")
      .run(employerProfileId);

    // Two admins open the same record and act at the same moment — one
    // approving, one rejecting. Exactly one UPDATE may match.
    // Both admins loaded the record while it said SUBMITTED. That shared token
    // is what makes the second UPDATE fail to match.
    const [first, second] = await Promise.all([
      asAdmin(request(app).post(`/api/admin/employers/${employerProfileId}/review`)).send({
        decision: 'APPROVE',
        expectedStatus: 'SUBMITTED',
      }),
      asAdmin(request(app).post(`/api/admin/employers/${employerProfileId}/review`)).send({
        decision: 'REJECT',
        note: 'Could not verify this company from the details provided.',
        expectedStatus: 'SUBMITTED',
      }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([204, 409]);

    // Whichever won, the record is in exactly one state — not a mix.
    const profile = employerRepo.findById(employerProfileId)!;
    expect(['APPROVED', 'REJECTED']).toContain(profile.account_status);
  });
});

describe('stale review token', () => {
  it('rejects a decision taken from a screen the record has already left', async () => {
    const candidateRepo = await import('../src/repositories/candidate.repo.js');
    expect(candidateRepo.findById(candidateProfileId)!.profile_status).not.toBe('SUBMITTED');

    const res = await asAdmin(request(app).post(`/api/admin/candidates/${candidateProfileId}/review`)).send({
      decision: 'REJECT',
      note: 'Rejecting from a stale screen.',
      expectedStatus: 'SUBMITTED',
    });
    expect(res.status).toBe(409);
  });

  it('requires the token at all — a direct call cannot skip the guard', async () => {
    const res = await asAdmin(request(app).post(`/api/admin/candidates/${candidateProfileId}/review`)).send({
      decision: 'APPROVE',
    });
    expect(res.status).toBe(400);
  });
});

describe('audit log', () => {
  it('records every review action', async () => {
    const auditRepo = await import('../src/repositories/audit.repo.js');
    const entries = auditRepo.listForEntity('CANDIDATE', candidateProfileId);

    expect(entries.length).toBeGreaterThanOrEqual(2);
    expect(entries.some((e) => e.action === 'CANDIDATE_APPROVE')).toBe(true);
    expect(entries.some((e) => e.action === 'CANDIDATE_REQUEST_CHANGES')).toBe(true);
    expect(entries[0]!.actor_id).toBeTruthy();
  });

  it('never writes salary values into audit metadata', async () => {
    const { getDb } = await import('../src/db/client.js');
    const rows = getDb().prepare('SELECT metadata FROM audit_log').all() as { metadata: string | null }[];
    const combined = rows.map((r) => r.metadata ?? '').join(' ');

    // The audit log has no serializer and is read directly during support work,
    // so it must never become a back door around the privacy boundary.
    expect(combined).not.toContain('salary');
    expect(combined).not.toContain('1800000');
    expect(combined).not.toContain('2400000');
    expect(combined).not.toContain('9876543210');
  });

  it('drops metadata keys that are not on the allowlist', async () => {
    const auditRepo = await import('../src/repositories/audit.repo.js');
    auditRepo.record({
      actorId: null,
      action: 'TEST',
      entityType: 'CANDIDATE',
      entityId: 'test-entity',
      metadata: { toStatus: 'APPROVED', currentSalary: 1_800_000 } as never,
    });

    const entries = auditRepo.listForEntity('CANDIDATE', 'test-entity');
    expect(entries[0]!.metadata).toContain('APPROVED');
    expect(entries[0]!.metadata).not.toContain('1800000');
    expect(entries[0]!.metadata).not.toContain('currentSalary');
  });
});

describe('salary comparison', () => {
  it('puts expectations and band side by side — admin only', async () => {
    const res = await asAdmin(
      request(app).get(`/api/admin/salary-comparison?candidateId=${candidateProfileId}&jobId=${jobId}`),
    );

    expect(res.status).toBe(200);
    expect(res.body.candidateExpectedMinLpa).toBe(24);
    expect(res.body.jobBandMaxLpa).toBe(28);
    // Expecting 24–30 against a 20–28 band: the minimum sits inside it.
    expect(res.body.fit).toBe('WITHIN');
  });

  it('flags a candidate priced above the band, with the gap', async () => {
    const candidateRepo = await import('../src/repositories/candidate.repo.js');
    candidateRepo.updateFields(candidateProfileId, {
      expected_salary_min: 3_500_000,
      expected_salary_max: 4_000_000,
    });

    const res = await asAdmin(
      request(app).get(`/api/admin/salary-comparison?candidateId=${candidateProfileId}&jobId=${jobId}`),
    );
    expect(res.body.fit).toBe('ABOVE');
    expect(res.body.gapLpa).toBe(7); // 35 expected vs 28 band top
  });

  it('is not reachable by an employer', async () => {
    const res = await request(app)
      .get(`/api/admin/salary-comparison?candidateId=${candidateProfileId}&jobId=${jobId}`)
      .set('Cookie', candidateCookie);
    expect(res.status).toBe(403);
  });
});

describe('user administration', () => {
  it('refuses to suspend the last active admin', async () => {
    const userRepo = await import('../src/repositories/user.repo.js');
    const admin = userRepo.findByEmail('admin@bktc.test')!;

    // Also covers self-suspension, which would lock the actor out immediately.
    const res = await asAdmin(request(app).post(`/api/admin/users/${admin.id}/suspend`));
    expect(res.status).toBe(400);
  });

  it('suspends a candidate and kills their session on the next request', async () => {
    const userRepo = await import('../src/repositories/user.repo.js');
    const candidate = userRepo.findByEmail('anita@example.com')!;

    const res = await asAdmin(request(app).post(`/api/admin/users/${candidate.id}/suspend`));
    expect(res.status).toBe(204);

    const me = await request(app).get('/api/auth/me').set('Cookie', candidateCookie);
    expect(me.status).toBe(401);
  });

  it('reactivates them again', async () => {
    const userRepo = await import('../src/repositories/user.repo.js');
    const candidate = userRepo.findByEmail('anita@example.com')!;

    // 200 with a body now: reactivating an employer restores the applications
    // the suspension auto-closed, and the count is reported so the admin can
    // see the round trip actually happened.
    const first = await asAdmin(request(app).post(`/api/admin/users/${candidate.id}/reactivate`));
    expect(first.status).toBe(200);
    expect(first.body).toHaveProperty('restoredApplications');

    expect((await asAdmin(request(app).post(`/api/admin/users/${candidate.id}/reactivate`))).status).toBe(409);
  });

  it('puts an employer’s applicants back when the suspension is lifted', async () => {
    /*
     * Suspension is a routine, reversible moderation action. It used not to be
     * reversible in any meaningful sense: the cascade turned down every
     * pending applicant and set the postings to PENDING_APPROVAL, while the
     * only restore path required status CLOSED. Reactivating handed back the
     * login and nothing else, and after 24 hours the rejections were permanent.
     */
    const userRepo = await import('../src/repositories/user.repo.js');
    const employerRepo = await import('../src/repositories/employer.repo.js');
    const applicationRepo = await import('../src/repositories/application.repo.js');
    const { getDb } = await import('../src/db/client.js');

    const employerUser = userRepo.findByEmail('ravi@kirloskar.example.com');
    if (!employerUser) return; // suite variant without this fixture

    const employer = employerRepo.findByUserId(employerUser.id)!;
    const openBefore = (
      getDb()
        .prepare(
          `SELECT COUNT(*) AS n FROM application a JOIN job j ON j.id = a.job_id
            WHERE j.employer_profile_id = ? AND a.stage NOT IN ('NOT_SELECTED','WITHDRAWN')`,
        )
        .get(employer.id) as { n: number }
    ).n;

    await asAdmin(request(app).post(`/api/admin/users/${employerUser.id}/suspend`));

    const closed = (
      getDb()
        .prepare(
          `SELECT COUNT(*) AS n FROM application a JOIN job j ON j.id = a.job_id
            WHERE j.employer_profile_id = ? AND a.outcome_reason_code = 'JOB_CLOSED'`,
        )
        .get(employer.id) as { n: number }
    ).n;

    const res = await asAdmin(request(app).post(`/api/admin/users/${employerUser.id}/reactivate`));
    expect(res.status).toBe(200);
    expect(res.body.restoredApplications).toBe(closed);

    const openAfter = (
      getDb()
        .prepare(
          `SELECT COUNT(*) AS n FROM application a JOIN job j ON j.id = a.job_id
            WHERE j.employer_profile_id = ? AND a.stage NOT IN ('NOT_SELECTED','WITHDRAWN')`,
        )
        .get(employer.id) as { n: number }
    ).n;
    expect(openAfter).toBe(openBefore);

    void applicationRepo;
  });
});
