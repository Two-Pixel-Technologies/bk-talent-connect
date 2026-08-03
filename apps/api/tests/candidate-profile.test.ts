/**
 * P2 exit checks.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestContext, CSRF_HEADER, sessionCookie, type TestContext } from './helpers/test-app.js';

let ctx: TestContext;
let app: Express;
let cookie: string;

/** A PDF header followed by filler — enough for the magic-byte check. */
const PDF_BYTES = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(2048, 0x20)]);
/** MZ — a Windows executable, renamed to .pdf below. */
const EXE_BYTES = Buffer.concat([Buffer.from([0x4d, 0x5a]), Buffer.alloc(1024, 0x00)]);

const COMPLETE_PROFILE = {
  fullName: 'Anita Desai',
  mobile: '9876543210',
  citySlug: 'pune',
  state: 'Maharashtra',
  openToRelocation: true,
  currentJobTitle: 'Senior Process Engineer',
  currentEmployer: 'Thermax',
  yearsOfExperience: 8,
  sectorSlug: 'pharmaceuticals-life-sciences',
  functionSlug: 'process-engineering',
  educationLevel: 'BTECH' as const,
  qualification: 'B.Tech Chemical Engineering',
  qualificationYear: 2017,
  careerSummary:
    'Process engineer with eight years across API manufacturing and formulation plants. ' +
    'I have led scale-up of three commercial products from pilot to full production, owned ' +
    'HAZOP studies for a greenfield block, and cut batch cycle time by 18% through a ' +
    'redesign of the crystallisation stage. Comfortable owning regulatory documentation.',
  noticePeriod: 'D30' as const,
  employmentPreference: 'FULL_TIME' as const,
  currentSalaryLpa: 18,
  expectedSalaryMinLpa: 24,
  expectedSalaryMaxLpa: 30,
  skills: ['HAZOP', 'Process Safety', 'GMP', 'Scale-up'],
  experiences: [
    {
      company: 'Thermax',
      title: 'Senior Process Engineer',
      startYear: 2020,
      isCurrent: true,
      domainTags: ['API'],
      keyAchievement: 'Cut batch cycle time by 18%.',
    },
  ],
};

beforeAll(async () => {
  ctx = await createTestContext('candidate');
  app = ctx.app;

  const res = await request(app).post('/api/auth/register/candidate').set(CSRF_HEADER).send({
    fullName: 'Anita Desai',
    email: 'anita@example.com',
    mobile: '9876543210',
    password: 'correct-horse-1',
    consentToShare: true,
  });
  cookie = sessionCookie(res);
});

afterAll(() => ctx.cleanup());

const auth = (r: request.Test) => r.set('Cookie', cookie).set(CSRF_HEADER);

describe('taxonomy', () => {
  it('exposes sectors, functions and cities as separate lists', async () => {
    const res = await request(app).get('/api/taxonomy');
    expect(res.status).toBe(200);
    // The split that stops a pharma QC chemist having to choose between
    // "Pharmaceuticals" and "Lab".
    expect(res.body.sectors.length).toBeGreaterThan(20);
    expect(res.body.functions.length).toBeGreaterThan(15);
    expect(res.body.cities.length).toBeGreaterThan(40);

    const sectorSlugs = res.body.sectors.map((s: { slug: string }) => s.slug);
    const functionSlugs = res.body.functions.map((f: { slug: string }) => f.slug);
    expect(sectorSlugs).toContain('pharmaceuticals-life-sciences');
    expect(functionSlugs).toContain('laboratory-testing');
  });

  it('suggests only approved skills', async () => {
    const res = await request(app).get('/api/skills?q=auto');
    expect(res.status).toBe(200);
    expect(res.body.skills.some((s: { name: string }) => s.name === 'AutoCAD')).toBe(true);
  });
});

describe('profile updates', () => {
  it('saves a step at a time and tracks completion', async () => {
    const before = await auth(request(app).get('/api/candidate/profile'));
    expect(before.body.completionPercent).toBeLessThan(30);

    const res = await auth(request(app).patch('/api/candidate/profile')).send({
      citySlug: 'pune',
      state: 'Maharashtra',
      openToRelocation: true,
    });

    expect(res.status).toBe(200);
    expect(res.body.profile.cityName).toBe('Pune');
    expect(res.body.profile.completionPercent).toBeGreaterThan(before.body.completionPercent);
  });

  it('rejects more skills than the limit allows', async () => {
    const res = await auth(request(app).patch('/api/candidate/profile')).send({
      skills: Array.from({ length: 25 }, (_, i) => `Skill ${i}`),
    });
    expect(res.status).toBe(400);
  });

  it('rejects an over-long career summary', async () => {
    const res = await auth(request(app).patch('/api/candidate/profile')).send({
      careerSummary: 'x'.repeat(3000),
    });
    expect(res.status).toBe(400);
  });

  it('converts salary from LPA to rupees and back without drift', async () => {
    const res = await auth(request(app).patch('/api/candidate/profile')).send({
      currentSalaryLpa: 18.5,
    });
    expect(res.body.profile.currentSalaryLpa).toBe(18.5);
  });
});

describe('resume upload', () => {
  it('rejects an executable renamed to .pdf', async () => {
    const res = await auth(request(app).post('/api/candidate/resume')).attach(
      'resume',
      EXE_BYTES,
      'cv.pdf',
    );
    // The extension and declared MIME type both say PDF; the bytes say MZ.
    expect(res.status).toBe(415);
  });

  it('accepts a genuine PDF', async () => {
    const res = await auth(request(app).post('/api/candidate/resume')).attach(
      'resume',
      PDF_BYTES,
      'anita-cv.pdf',
    );
    expect(res.status).toBe(201);
    expect(res.body.hasResume).toBe(true);
  });

  it('serves the file back to its owner as an attachment', async () => {
    const profile = await auth(request(app).get('/api/candidate/profile'));
    expect(profile.body.hasResume).toBe(true);

    const fileRepo = await import('../src/repositories/file.repo.js');
    const candidateRepo = await import('../src/repositories/candidate.repo.js');
    const me = await auth(request(app).get('/api/auth/me'));
    const row = candidateRepo.findByUserId(me.body.id)!;
    const file = fileRepo.findById(row.resume_file_id!)!;

    const res = await request(app).get(`/api/files/${file.id}`).set('Cookie', cookie);
    expect(res.status).toBe(200);
    // Never inline: a PDF with embedded JavaScript would run in the viewer's
    // session context.
    expect(res.headers['content-disposition']).toMatch(/^attachment/);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('refuses to serve another candidate’s resume', async () => {
    const other = await request(app).post('/api/auth/register/candidate').set(CSRF_HEADER).send({
      fullName: 'Rohit Sharma',
      email: 'rohit@example.com',
      mobile: '9000000000',
      password: 'correct-horse-3',
      consentToShare: true,
    });
    const otherCookie = sessionCookie(other);

    const candidateRepo = await import('../src/repositories/candidate.repo.js');
    const me = await auth(request(app).get('/api/auth/me'));
    const row = candidateRepo.findByUserId(me.body.id)!;

    const res = await request(app)
      .get(`/api/files/${row.resume_file_id}`)
      .set('Cookie', otherCookie);
    expect(res.status).toBe(403);
  });

  it('requires a session at all', async () => {
    const res = await request(app).get('/api/files/anything');
    expect(res.status).toBe(401);
  });
});

describe('submission', () => {
  it('refuses an incomplete profile and says exactly what is missing', async () => {
    const fresh = await request(app).post('/api/auth/register/candidate').set(CSRF_HEADER).send({
      fullName: 'Incomplete Person',
      email: 'incomplete@example.com',
      mobile: '9111111111',
      password: 'correct-horse-4',
      consentToShare: true,
    });
    const freshCookie = sessionCookie(fresh);

    const res = await request(app)
      .post('/api/candidate/profile/submit')
      .set('Cookie', freshCookie)
      .set(CSRF_HEADER);

    expect(res.status).toBe(400);
    const paths = res.body.error.fields.map((f: { path: string }) => f.path);
    expect(paths).toContain('careerSummary');
    expect(paths).toContain('skillCount');
    expect(paths).toContain('hasResume');
  });

  it('accepts a complete profile and moves it to review', async () => {
    await auth(request(app).patch('/api/candidate/profile')).send(COMPLETE_PROFILE);

    const res = await auth(request(app).post('/api/candidate/profile/submit'));
    expect(res.status).toBe(200);
    expect(res.body.profileStatus).toBe('SUBMITTED');
    expect(res.body.completionPercent).toBe(100);
  });
});

describe('D2 — editing after approval', () => {
  beforeAll(async () => {
    // Approve directly; the admin review UI arrives in P4.
    const candidateRepo = await import('../src/repositories/candidate.repo.js');
    const me = await auth(request(app).get('/api/auth/me'));
    const profile = candidateRepo.findByUserId(me.body.id)!;
    candidateRepo.setStatus(profile.id, 'APPROVED');
  });

  it('applies a non-material edit immediately, keeping the profile approved', async () => {
    const res = await auth(request(app).patch('/api/candidate/profile')).send({
      mobile: '9998887776',
      noticePeriod: 'IMMEDIATE',
    });

    expect(res.status).toBe(200);
    expect(res.body.requiresReapproval).toBe(false);
    // The whole point: a candidate can fix their phone number without losing
    // access to the job list.
    expect(res.body.profile.profileStatus).toBe('APPROVED');
    expect(res.body.profile.mobile).toBe('9998887776');
  });

  it('sends a material edit back for review', async () => {
    const res = await auth(request(app).patch('/api/candidate/profile')).send({
      skills: ['HAZOP', 'Process Safety', 'GMP', 'Six Sigma', 'Lean Manufacturing'],
    });

    expect(res.status).toBe(200);
    expect(res.body.requiresReapproval).toBe(true);
    expect(res.body.materialChanges).toContain('skills');
    expect(res.body.profile.profileStatus).toBe('SUBMITTED');
  });
});

describe('privacy', () => {
  it('never exposes the private salary columns under their database names', async () => {
    const res = await auth(request(app).get('/api/candidate/profile'));
    const serialised = JSON.stringify(res.body);

    // The candidate sees their own figures in LPA, but the raw columns must not
    // leak — those names are what an employer-facing view must never contain.
    expect(serialised).not.toContain('current_salary');
    expect(serialised).not.toContain('expected_salary_min');
    expect(serialised).not.toContain('expected_salary_max');
  });

  it('does not expose internal review or user ids to the candidate', async () => {
    const res = await auth(request(app).get('/api/candidate/profile'));
    expect(res.body).not.toHaveProperty('reviewedById');
    expect(res.body).not.toHaveProperty('userId');
    expect(res.body).not.toHaveProperty('lastApprovedSnapshot');
  });
});

describe('role isolation', () => {
  it('blocks an employer from the candidate profile routes', async () => {
    const employer = await request(app).post('/api/auth/register/employer').set(CSRF_HEADER).send({
      companyName: 'Kirloskar',
      hrContactName: 'Ravi Menon',
      email: 'ravi@kirloskar.example.com',
      hrContactPhone: '9876500000',
      password: 'correct-horse-5',
    });

    const res = await request(app)
      .get('/api/candidate/profile')
      .set('Cookie', sessionCookie(employer));
    expect(res.status).toBe(403);
  });
});
