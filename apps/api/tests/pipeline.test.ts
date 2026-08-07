/**
 * P5 exit checks.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { ALLOWED_TRANSITIONS, canTransition, APPLICATION_STAGES, type ApplicationStage } from '@bktc/shared';
import { createTestContext, CSRF_HEADER, sessionCookie, type TestContext } from './helpers/test-app.js';

let ctx: TestContext;
let app: Express;
let candidateCookie: string;
let otherCandidateCookie: string;
let employerCookie: string;
let candidateProfileId: string;
let jobId: string;
let applicationId: string;

const PDF = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(512, 0x20)]);

beforeAll(async () => {
  ctx = await createTestContext('pipeline');
  app = ctx.app;

  const { getDb } = await import('../src/db/client.js');
  const candidateRepo = await import('../src/repositories/candidate.repo.js');
  const employerRepo = await import('../src/repositories/employer.repo.js');
  const jobRepo = await import('../src/repositories/job.repo.js');

  // Approved candidate with a CV.
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
  candidateRepo.updateFields(candidateProfileId, {
    current_salary: 1_800_000,
    expected_salary_min: 2_400_000,
    expected_salary_max: 3_000_000,
  });

  // A second candidate, left unapproved.
  const other = await request(app).post('/api/auth/register/candidate').set(CSRF_HEADER).send({
    fullName: 'Rohit Kulkarni',
    email: 'rohit@example.com',
    mobile: '9823012345',
    password: 'correct-horse-2',
    consentToShare: true,
  });
  otherCandidateCookie = sessionCookie(other);

  // Approved employer with a live job.
  const employer = await request(app).post('/api/auth/register/employer').set(CSRF_HEADER).send({
    companyName: 'Kirloskar Systems',
    hrContactName: 'Ravi Menon',
    email: 'ravi@kirloskar.example.com',
    hrContactPhone: '9876500000',
    password: 'correct-horse-3',
  });
  employerCookie = sessionCookie(employer);
  const employerMe = await request(app).get('/api/auth/me').set('Cookie', employerCookie);
  const employerProfileId = employerRepo.findByUserId(employerMe.body.id)!.id;
  getDb().prepare("UPDATE employer_profile SET account_status = 'APPROVED' WHERE id = ?").run(employerProfileId);

  jobId = jobRepo.create(employerProfileId, 'Senior Process Engineer');
  jobRepo.updateFields(jobId, {
    sector_id: 1,
    city_id: 1,
    min_experience: 5,
    max_experience: 10,
    salary_band_min: 2_000_000,
    salary_band_max: 2_800_000,
    description: 'A senior process engineering role.',
  });
  jobRepo.setStatus(jobId, 'APPROVED', ['DRAFT'], { publishedAt: new Date().toISOString() });
});

afterAll(() => ctx.cleanup());

const asCandidate = (r: request.Test) => r.set('Cookie', candidateCookie).set(CSRF_HEADER);
const asEmployer = (r: request.Test) => r.set('Cookie', employerCookie).set(CSRF_HEADER);

describe('the approval gate', () => {
  it('shows an unapproved candidate zero jobs', async () => {
    const res = await request(app).get('/api/candidate/jobs').set('Cookie', otherCandidateCookie);
    // Not an empty list — an explicit refusal, so the reason is visible.
    expect(res.status).toBe(403);
  });

  it('blocks an unapproved candidate from applying', async () => {
    const res = await request(app)
      .post(`/api/candidate/jobs/${jobId}/apply`)
      .set('Cookie', otherCandidateCookie)
      .set(CSRF_HEADER);
    expect(res.status).toBe(403);
  });

  it('opens the job list the moment the profile is approved', async () => {
    const candidateRepo = await import('../src/repositories/candidate.repo.js');
    candidateRepo.setStatus(candidateProfileId, 'APPROVED');

    const res = await asCandidate(request(app).get('/api/candidate/jobs'));
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(1);
  });
});

describe('browsing', () => {
  it('hides the employer identity and the salary band', async () => {
    const res = await asCandidate(request(app).get('/api/candidate/jobs'));
    const serialised = JSON.stringify(res.body);

    expect(serialised).not.toContain('Kirloskar');
    expect(serialised).not.toContain('salaryBand');
    expect(serialised).not.toContain('salary_band');
  });

  it('never lists a job that is not live', async () => {
    const jobRepo = await import('../src/repositories/job.repo.js');
    const draftId = jobRepo.create(
      (await import('../src/repositories/employer.repo.js')).findByUserId(
        (await request(app).get('/api/auth/me').set('Cookie', employerCookie)).body.id,
      )!.id,
      'Draft role nobody should see',
    );

    const res = await asCandidate(request(app).get('/api/candidate/jobs'));
    const ids = res.body.items.map((j: { id: string }) => j.id);
    expect(ids).not.toContain(draftId);
  });

  it('filters by sector and city', async () => {
    const match = await asCandidate(request(app).get('/api/candidate/jobs?city=ahmedabad'));
    expect(match.body.total).toBe(0);
  });

  it('rejects an unknown sort key', async () => {
    const res = await asCandidate(request(app).get('/api/candidate/jobs?sort=salary_band_min'));
    expect(res.status).toBe(400);
  });
});

describe('applying', () => {
  it('creates an application with its first stage event', async () => {
    const res = await asCandidate(request(app).post(`/api/candidate/jobs/${jobId}/apply`));
    expect(res.status).toBe(201);
    applicationId = res.body.applicationId;

    const applicationRepo = await import('../src/repositories/application.repo.js');
    const events = applicationRepo.listStageEvents(applicationId);
    // The row and its history commit together — there is never one without the other.
    expect(events.length).toBe(1);
    expect(events[0]!.to_stage).toBe('APPLIED');
  });

  it('snapshots which CV was current at the time', async () => {
    const applicationRepo = await import('../src/repositories/application.repo.js');
    expect(applicationRepo.findById(applicationId)!.resume_file_id_at_apply).toBeTruthy();
  });

  it('blocks a duplicate application', async () => {
    const res = await asCandidate(request(app).post(`/api/candidate/jobs/${jobId}/apply`));
    expect(res.status).toBe(409);
  });

  it('refuses to apply to a job that is no longer live', async () => {
    const jobRepo = await import('../src/repositories/job.repo.js');
    const employerRepo = await import('../src/repositories/employer.repo.js');
    const employerMe = await request(app).get('/api/auth/me').set('Cookie', employerCookie);
    const closedId = jobRepo.create(employerRepo.findByUserId(employerMe.body.id)!.id, 'Closed role');
    jobRepo.setStatus(closedId, 'APPROVED', ['DRAFT'], { publishedAt: new Date().toISOString() });
    jobRepo.setStatus(closedId, 'CLOSED', ['APPROVED']);

    const res = await asCandidate(request(app).post(`/api/candidate/jobs/${closedId}/apply`));
    expect(res.status).toBe(409);
  });
});

describe('the candidate tracker', () => {
  it('shows the application with contract wording, and no company yet', async () => {
    const res = await asCandidate(request(app).get('/api/candidate/applications'));
    expect(res.status).toBe(200);

    const application = res.body.items[0];
    expect(application.stageLabel).toBe('Applied');
    // Anonymous until shortlist.
    expect(application.employerName).toBeNull();
    expect(application.timeline.length).toBe(1);
  });

  it('refuses to reveal the company before shortlist', async () => {
    const res = await asCandidate(request(app).get(`/api/candidate/applications/${applicationId}/company`));
    expect(res.status).toBe(403);
  });

  it('will not show another candidate’s application', async () => {
    const candidateRepo = await import('../src/repositories/candidate.repo.js');
    const otherMe = await request(app).get('/api/auth/me').set('Cookie', otherCandidateCookie);
    candidateRepo.setStatus(candidateRepo.findByUserId(otherMe.body.id)!.id, 'APPROVED');

    const res = await request(app)
      .post(`/api/candidate/applications/${applicationId}/withdraw`)
      .set('Cookie', otherCandidateCookie)
      .set(CSRF_HEADER);
    expect(res.status).toBe(403);
  });
});

describe('the employer applicant list', () => {
  it('carries no salary, email or mobile', async () => {
    const res = await asEmployer(request(app).get(`/api/employer/jobs/${jobId}/applications`));
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(1);

    const serialised = JSON.stringify(res.body.items);
    // The single most important assertion in the product.
    expect(serialised).not.toContain('currentSalary');
    expect(serialised).not.toContain('expectedSalary');
    expect(serialised).not.toContain('9876543210');
    expect(serialised).not.toContain('anita@example.com');

    const candidate = res.body.items[0].candidate;
    expect(candidate.fullName).toBe('Anita Desai');
    expect(candidate).not.toHaveProperty('mobile');
    expect(candidate).not.toHaveProperty('email');
  });

  it('rejects a sort by a hidden salary column', async () => {
    // Sorting by a stripped field would leak its ORDER even though the value
    // never appears — an employer could binary-search expectations.
    const res = await asEmployer(
      request(app).get(`/api/employer/jobs/${jobId}/applications?sort=expectedSalaryMin`),
    );
    expect(res.status).toBe(400);
  });

  it('refuses another employer’s job', async () => {
    const other = await request(app).post('/api/auth/register/employer').set(CSRF_HEADER).send({
      companyName: 'Zydus',
      hrContactName: 'Neha Gupta',
      email: 'neha@zydus.example.com',
      hrContactPhone: '9898776655',
      password: 'correct-horse-4',
    });

    const res = await request(app)
      .get(`/api/employer/jobs/${jobId}/applications`)
      .set('Cookie', sessionCookie(other));
    expect(res.status).toBe(403);
  });

  /**
   * Superseded by the audit's CRIT-3.
   *
   * The original behaviour filtered these rows out entirely, which meant a
   * shortlisted candidate could silently vanish from an employer's board and
   * reappear later with nobody told. The row now stays and is marked
   * unavailable; the CV is withheld by the download route's own check.
   */
  it('marks a candidate whose profile is no longer approved as unavailable, without hiding them', async () => {
    const candidateRepo = await import('../src/repositories/candidate.repo.js');
    candidateRepo.setStatus(candidateProfileId, 'REJECTED');

    const res = await asEmployer(request(app).get(`/api/employer/jobs/${jobId}/applications`));
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].candidateAvailable).toBe(false);
    expect(res.body.items[0].resumeFileId).toBeNull();

    candidateRepo.setStatus(candidateProfileId, 'APPROVED');
  });

  it('drops a candidate whose account has been suspended', async () => {
    const { getDb } = await import('../src/db/client.js');
    const candidateRepo = await import('../src/repositories/candidate.repo.js');
    const profile = candidateRepo.findById(candidateProfileId)!;
    getDb().prepare("UPDATE user SET status='SUSPENDED' WHERE id=?").run(profile.user_id);

    const res = await asEmployer(request(app).get(`/api/employer/jobs/${jobId}/applications`));
    expect(res.body.items.length).toBe(0);

    getDb().prepare("UPDATE user SET status='ACTIVE' WHERE id=?").run(profile.user_id);
  });
});

describe('D1 — resume visibility', () => {
  it('lets the employer open the CV at APPLIED, once the candidate is approved', async () => {
    const list = await asEmployer(request(app).get(`/api/employer/jobs/${jobId}/applications`));
    const resumeFileId = list.body.items[0].resumeFileId;
    expect(resumeFileId).toBeTruthy();

    const res = await request(app).get(`/api/files/${resumeFileId}`).set('Cookie', employerCookie);
    // D1: the gate is profile approval, not application stage.
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/^attachment/);
  });

  it('refuses an employer with no application to that candidate', async () => {
    const applicationRepo = await import('../src/repositories/application.repo.js');
    const candidateRepo = await import('../src/repositories/candidate.repo.js');
    const profile = candidateRepo.findById(candidateProfileId)!;

    const other = await request(app).post('/api/auth/register/employer').set(CSRF_HEADER).send({
      companyName: 'Unrelated Co',
      hrContactName: 'Someone Else',
      email: 'someone@unrelated.example.com',
      hrContactPhone: '9000011111',
      password: 'correct-horse-5',
    });

    const res = await request(app)
      .get(`/api/files/${profile.resume_file_id}`)
      .set('Cookie', sessionCookie(other));
    // Approval alone must not be enough, or any employer could read any CV.
    expect(res.status).toBe(403);

    const employerRepo = await import('../src/repositories/employer.repo.js');
    const otherMe = await request(app).get('/api/auth/me').set('Cookie', sessionCookie(other));
    expect(
      applicationRepo.employerMayViewCandidateFiles(
        employerRepo.findByUserId(otherMe.body.id)!.id,
        profile.user_id,
      ),
    ).toBe(false);
  });
});

describe('stage transitions', () => {
  it('lets the employer move an applicant through their own stages', async () => {
    const list = await asEmployer(request(app).get(`/api/employer/jobs/${jobId}/applications`));
    const id = list.body.items[0].id;

    const review = await asEmployer(request(app).post(`/api/employer/applications/${id}/stage`)).send({
      stage: 'UNDER_REVIEW',
    });
    expect(review.status).toBe(200);
    expect(review.body.bucket).toBe('REVIEWING');

    const shortlist = await asEmployer(request(app).post(`/api/employer/applications/${id}/stage`)).send({
      stage: 'SHORTLISTED',
    });
    expect(shortlist.status).toBe(200);
  });

  it('records the employer’s first action for the response-time metric', async () => {
    const applicationRepo = await import('../src/repositories/application.repo.js');
    expect(applicationRepo.findById(applicationId)!.first_employer_action_at).toBeTruthy();
  });

  it('refuses to let an employer schedule an interview themselves', async () => {
    const res = await asEmployer(request(app).post(`/api/employer/applications/${applicationId}/stage`)).send({
      stage: 'INTERVIEW_SCHEDULED',
    });
    // BK coordinates every interview; the employer requests one (P6).
    expect(res.status).toBe(403);
  });

  it('rejects an illegal jump', async () => {
    const res = await asEmployer(request(app).post(`/api/employer/applications/${applicationId}/stage`)).send({
      stage: 'JOINED',
    });
    expect(res.status).toBe(403);
  });

  it('reveals the company once shortlisted', async () => {
    const res = await asCandidate(request(app).get(`/api/candidate/applications/${applicationId}/company`));
    expect(res.status).toBe(200);
    expect(res.body.companyName).toBe('Kirloskar Systems');
    // Still no route to the employer directly.
    expect(res.body).not.toHaveProperty('hrContactEmail');
    expect(res.body).not.toHaveProperty('hrContactPhone');
  });

  it('names the company on the tracker from shortlist onward', async () => {
    const res = await asCandidate(request(app).get('/api/candidate/applications'));
    const application = res.body.items.find((a: { id: string }) => a.id === applicationId);
    expect(application.employerName).toBe('Kirloskar Systems');
    expect(application.stageLabel).toBe('Shortlisted');
  });
});

describe('the transition matrix', () => {
  it('agrees with itself for every declared transition', () => {
    for (const t of ALLOWED_TRANSITIONS) {
      for (const role of t.roles) {
        expect(canTransition(t.from, t.to, role).allowed, `${t.from}->${t.to} as ${role}`).toBe(true);
      }
    }
  });

  it('refuses everything not declared', () => {
    const declared = new Set(ALLOWED_TRANSITIONS.map((t) => `${t.from}->${t.to}`));
    for (const from of APPLICATION_STAGES) {
      for (const to of APPLICATION_STAGES) {
        if (from === to) continue;
        if (declared.has(`${from}->${to}`)) continue;
        if (from === 'NOT_SELECTED') continue; // time-bounded, tested separately

        const result = canTransition(from as ApplicationStage, to as ApplicationStage, 'ADMIN');
        expect(result.allowed, `${from}->${to} should be refused`).toBe(false);
      }
    }
  });

  it('lets an admin reverse a rejection inside 24 hours, but not after', () => {
    const now = new Date();
    const recent = new Date(now.getTime() - 60 * 60 * 1000);
    const old = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    expect(
      canTransition('NOT_SELECTED', 'SHORTLISTED', 'ADMIN', { stageChangedAt: recent, now }).allowed,
    ).toBe(true);
    expect(
      canTransition('NOT_SELECTED', 'SHORTLISTED', 'ADMIN', { stageChangedAt: old, now }).allowed,
    ).toBe(false);
    // Never the employer's to reverse.
    expect(
      canTransition('NOT_SELECTED', 'SHORTLISTED', 'EMPLOYER', { stageChangedAt: recent, now }).allowed,
    ).toBe(false);
  });
});

describe('withdraw and re-apply', () => {
  it('lets a candidate withdraw', async () => {
    const res = await asCandidate(request(app).post(`/api/candidate/applications/${applicationId}/withdraw`));
    expect(res.status).toBe(200);
  });

  it('removes them from the employer’s list', async () => {
    const res = await asEmployer(request(app).get(`/api/employer/jobs/${jobId}/applications?stage=WITHDRAWN`));
    expect(res.body.items.length).toBe(1);

    const active = await asEmployer(request(app).get(`/api/employer/jobs/${jobId}/applications?stage=SHORTLISTED`));
    expect(active.body.items.length).toBe(0);
  });

  it('allows re-applying — the unique constraint must not be a permanent lockout', async () => {
    const res = await asCandidate(request(app).post(`/api/candidate/jobs/${jobId}/apply`));
    expect(res.status).toBe(201);
    expect(res.body.reopened).toBe(true);
    // Reuses the reserved row rather than creating a second one.
    expect(res.body.applicationId).toBe(applicationId);

    const applicationRepo = await import('../src/repositories/application.repo.js');
    expect(applicationRepo.findById(applicationId)!.stage).toBe('APPLIED');
  });
});

describe('closing a job', () => {
  it('resolves the applications nobody has acted on', async () => {
    const closed = await asEmployer(request(app).post(`/api/employer/jobs/${jobId}/close`));
    expect(closed.status).toBe(200);

    const applicationRepo = await import('../src/repositories/application.repo.js');
    const application = applicationRepo.findById(applicationId)!;
    // The candidate is told, rather than watching a tracker that never moves.
    expect(application.stage).toBe('NOT_SELECTED');
    expect(application.outcome_reason_code).toBe('JOB_CLOSED');

    const events = applicationRepo.listStageEvents(applicationId);
    expect(events[events.length - 1]!.changed_by_role).toBe('SYSTEM');
  });
});
