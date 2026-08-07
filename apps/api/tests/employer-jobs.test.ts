/**
 * P3 exit checks.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { findContactDetails } from '@bktc/shared';
import { createTestContext, CSRF_HEADER, sessionCookie, type TestContext } from './helpers/test-app.js';

let ctx: TestContext;
let app: Express;
let approvedCookie: string;
let pendingCookie: string;
let jobId: string;

const COMPLETE_JOB = {
  title: 'Senior Process Engineer',
  department: 'Production',
  numberOfPositions: 2,
  sectorSlug: 'pharmaceuticals-life-sciences',
  functionSlug: 'process-engineering',
  citySlug: 'pune',
  state: 'Maharashtra',
  workType: 'ONSITE' as const,
  minExperience: 5,
  maxExperience: 10,
  educationRequirement: 'BTECH' as const,
  requiredSkills: ['HAZOP', 'Process Safety', 'GMP'],
  goodToHaveSkills: ['Six Sigma'],
  salaryBandMinLpa: 20,
  salaryBandMaxLpa: 28,
  description:
    'We are looking for a senior process engineer to own scale-up and process safety for our ' +
    'API block in Pune. You will lead HAZOP studies, own the process design basis for new ' +
    'products moving from pilot to commercial scale, and work alongside the QA and regulatory ' +
    'teams on documentation for regulated markets. The role reports to the Head of Manufacturing ' +
    'and has two direct reports. We run a modern plant with DCS control throughout and have ' +
    'invested heavily in automation over the last three years. You will be involved from the ' +
    'earliest technology transfer discussions right through to commercial production, which ' +
    'means genuine ownership rather than executing someone else plan. Candidates should be ' +
    'comfortable presenting to auditors and driving cross functional projects to completion ' +
    'without close supervision, and should enjoy solving problems on the shop floor as much as ' +
    'at a desk. We offer a competitive package and real progression into plant leadership.',
};

beforeAll(async () => {
  ctx = await createTestContext('employer');
  app = ctx.app;

  const approved = await request(app).post('/api/auth/register/employer').set(CSRF_HEADER).send({
    companyName: 'Kirloskar Systems',
    hrContactName: 'Ravi Menon',
    email: 'ravi@kirloskar.example.com',
    hrContactPhone: '9876500000',
    password: 'correct-horse-1',
  });
  approvedCookie = sessionCookie(approved);

  const pending = await request(app).post('/api/auth/register/employer').set(CSRF_HEADER).send({
    companyName: 'Zydus Lifesciences',
    hrContactName: 'Neha Gupta',
    email: 'neha@zydus.example.com',
    hrContactPhone: '9898776655',
    password: 'correct-horse-2',
  });
  pendingCookie = sessionCookie(pending);

  // Approve the first company directly; the admin review UI lands in P4.
  const employerRepo = await import('../src/repositories/employer.repo.js');
  const me = await request(app).get('/api/auth/me').set('Cookie', approvedCookie);
  const profile = employerRepo.findByUserId(me.body.id)!;
  const { getDb } = await import('../src/db/client.js');
  getDb().prepare("UPDATE employer_profile SET account_status = 'APPROVED' WHERE id = ?").run(profile.id);
});

afterAll(() => ctx.cleanup());

const asApproved = (r: request.Test) => r.set('Cookie', approvedCookie).set(CSRF_HEADER);
const asPending = (r: request.Test) => r.set('Cookie', pendingCookie).set(CSRF_HEADER);

describe('verification gate', () => {
  it('blocks an unverified company from creating a posting', async () => {
    const res = await asPending(request(app).post('/api/employer/jobs')).send({
      title: 'Design Engineer',
    });
    expect(res.status).toBe(403);
  });

  it('allows a verified company to create one', async () => {
    const res = await asApproved(request(app).post('/api/employer/jobs')).send({
      title: 'Senior Process Engineer',
    });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('DRAFT');
    jobId = res.body.id;
  });
});

describe('ownership', () => {
  it('refuses another employer’s job with 403, not 404', async () => {
    const res = await asPending(request(app).get(`/api/employer/jobs/${jobId}`));
    // 403 for both "not yours" and "does not exist" — distinguishing them would
    // confirm which job ids are real.
    expect(res.status).toBe(403);
  });

  it('refuses a made-up job id the same way', async () => {
    const res = await asApproved(request(app).get('/api/employer/jobs/01JUNKJUNKJUNKJUNKJUNKJUNK'));
    expect(res.status).toBe(403);
  });

  it('refuses to let another employer edit it', async () => {
    const res = await asPending(request(app).patch(`/api/employer/jobs/${jobId}`)).send({
      title: 'Hijacked',
    });
    expect(res.status).toBe(403);
  });

  it('blocks a candidate from the employer routes entirely', async () => {
    const candidate = await request(app).post('/api/auth/register/candidate').set(CSRF_HEADER).send({
      fullName: 'Anita Desai',
      email: 'anita@example.com',
      mobile: '9876543210',
      password: 'correct-horse-3',
      consentToShare: true,
    });
    const res = await request(app)
      .get('/api/employer/jobs')
      .set('Cookie', sessionCookie(candidate));
    expect(res.status).toBe(403);
  });
});

describe('submission', () => {
  it('refuses an incomplete posting and names what is missing', async () => {
    const res = await asApproved(request(app).post(`/api/employer/jobs/${jobId}/submit`));
    expect(res.status).toBe(400);
    const paths = res.body.error.fields.map((f: { path: string }) => f.path);
    expect(paths).toContain('description');
    expect(paths).toContain('requiredSkillCount');
    expect(paths).toContain('salaryBandMinLpa');
  });

  it('rejects fewer than three required skills', async () => {
    await asApproved(request(app).patch(`/api/employer/jobs/${jobId}`)).send({
      ...COMPLETE_JOB,
      requiredSkills: ['HAZOP'],
    });
    const res = await asApproved(request(app).post(`/api/employer/jobs/${jobId}/submit`));
    expect(res.status).toBe(400);
    expect(res.body.error.fields.map((f: { path: string }) => f.path)).toContain('requiredSkillCount');
  });

  it('rejects a max experience below the min', async () => {
    await asApproved(request(app).patch(`/api/employer/jobs/${jobId}`)).send({
      ...COMPLETE_JOB,
      minExperience: 10,
      maxExperience: 4,
    });
    const res = await asApproved(request(app).post(`/api/employer/jobs/${jobId}/submit`));
    expect(res.status).toBe(400);
    expect(res.body.error.fields.map((f: { path: string }) => f.path)).toContain('maxExperience');
  });

  it('rejects a salary band whose max is below its min', async () => {
    await asApproved(request(app).patch(`/api/employer/jobs/${jobId}`)).send({
      ...COMPLETE_JOB,
      salaryBandMinLpa: 30,
      salaryBandMaxLpa: 12,
    });
    const res = await asApproved(request(app).post(`/api/employer/jobs/${jobId}/submit`));
    expect(res.status).toBe(400);
    expect(res.body.error.fields.map((f: { path: string }) => f.path)).toContain('salaryBandMaxLpa');
  });

  it('accepts a complete posting and sends it for review', async () => {
    await asApproved(request(app).patch(`/api/employer/jobs/${jobId}`)).send(COMPLETE_JOB);
    const res = await asApproved(request(app).post(`/api/employer/jobs/${jobId}/submit`));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('PENDING_APPROVAL');
    // Not live yet — an admin has to approve it.
    expect(res.body.publishedAt).toBeNull();
  });
});

describe('salary band confidentiality', () => {
  it('shows the band to the owning employer', async () => {
    const res = await asApproved(request(app).get(`/api/employer/jobs/${jobId}`));
    expect(res.body.salaryBandMinLpa).toBe(20);
    expect(res.body.salaryBandMaxLpa).toBe(28);
  });

  it('omits it from the public and candidate views', async () => {
    const { toPublicView, toCandidateView } = await import('../src/serializers/job.serializer.js');
    const jobRepo = await import('../src/repositories/job.repo.js');
    const service = await import('../src/modules/employer/employer.service.js');

    const row = jobRepo.findById(jobId)!;
    const relations = service.loadJobRelations(row);

    for (const view of [toPublicView(row, relations), toCandidateView(row, relations)]) {
      const serialised = JSON.stringify(view);
      expect(serialised).not.toContain('salaryBand');
      expect(serialised).not.toContain('salary_band');
      // Anonymous listing: the company is revealed only at shortlist.
      expect(serialised).not.toContain('Kirloskar');
      expect(view).not.toHaveProperty('employerName');
    }
  });
});

describe('D3 — editing after approval', () => {
  beforeAll(async () => {
    const jobRepo = await import('../src/repositories/job.repo.js');
    jobRepo.setStatus(jobId, 'APPROVED', ['PENDING_APPROVAL'], {
      publishedAt: new Date().toISOString(),
    });
  });

  it('keeps a non-material edit live', async () => {
    const res = await asApproved(request(app).patch(`/api/employer/jobs/${jobId}`)).send({
      numberOfPositions: 5,
      targetJoiningDate: '2026-11-01',
    });

    expect(res.status).toBe(200);
    expect(res.body.requiresReapproval).toBe(false);
    expect(res.body.job.status).toBe('APPROVED');
    expect(res.body.job.numberOfPositions).toBe(5);
    // Still published — it never left the listings.
    expect(res.body.job.publishedAt).not.toBeNull();
  });

  it('unpublishes on a material edit and sends it back for review', async () => {
    const res = await asApproved(request(app).patch(`/api/employer/jobs/${jobId}`)).send({
      description: `${COMPLETE_JOB.description} We have also added a second shift this year.`,
    });

    expect(res.status).toBe(200);
    expect(res.body.requiresReapproval).toBe(true);
    expect(res.body.materialChanges).toContain('description');
    expect(res.body.job.status).toBe('PENDING_APPROVAL');
    // The critical half: it must leave public listings, not merely be marked.
    expect(res.body.unpublished).toBe(true);
    expect(res.body.job.publishedAt).toBeNull();
  });
});

describe('contact details in the description', () => {
  it('detects emails, phone numbers and URLs', () => {
    const findings = findContactDetails(
      'Call Ravi on 98765 43210 or email ravi@kirloskar.com — see www.kirloskar.com/careers',
    );
    const kinds = findings.map((f) => f.kind);
    expect(kinds).toContain('phone');
    expect(kinds).toContain('email');
    expect(kinds).toContain('url');
  });

  it('does not flag ordinary numbers in a job description', () => {
    const findings = findContactDetails(
      'ISO 9001 certified plant with 10 years of operation and a team of 250 across 3 shifts.',
    );
    expect(findings).toEqual([]);
  });

  it('flags a posting whose description carries contact details', async () => {
    await asApproved(request(app).patch(`/api/employer/jobs/${jobId}`)).send({
      description: `${COMPLETE_JOB.description} Contact me directly on 9876543210.`,
    });

    const jobRepo = await import('../src/repositories/job.repo.js');
    const row = jobRepo.findById(jobId)!;
    expect(row.contact_flags).toBeTruthy();

    const flags = JSON.parse(row.contact_flags!) as { kind: string }[];
    expect(flags.some((f) => f.kind === 'phone')).toBe(true);
  });

  it('clears the flag when the contact details are removed', async () => {
    await asApproved(request(app).patch(`/api/employer/jobs/${jobId}`)).send({
      description: COMPLETE_JOB.description,
    });

    const jobRepo = await import('../src/repositories/job.repo.js');
    expect(jobRepo.findById(jobId)!.contact_flags).toBeNull();
  });
});

describe('sort allowlist', () => {
  it('rejects an unknown sort key rather than silently ignoring it', async () => {
    const res = await asApproved(request(app).get('/api/employer/jobs?sort=salary_band_min'));
    expect(res.status).toBe(400);
  });

  it('rejects an unknown sort direction', async () => {
    const res = await asApproved(request(app).get('/api/employer/jobs?sort=title&dir=DROP'));
    expect(res.status).toBe(400);
  });

  it('accepts an allowlisted key', async () => {
    const res = await asApproved(request(app).get('/api/employer/jobs?sort=title&dir=ASC'));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });
});

describe('closing', () => {
  it('closes a posting, clears its publication date, and reports the impact', async () => {
    const res = await asApproved(request(app).post(`/api/employer/jobs/${jobId}/close`));
    expect(res.status).toBe(200);
    expect(res.body.job.status).toBe('CLOSED');
    expect(res.body.job.publishedAt).toBeNull();
    // Surfaced rather than discarded, so the UI can tell the employer how many
    // people that button just rejected.
    expect(typeof res.body.closedApplications).toBe('number');
  });

  it('reports the close impact before doing it', async () => {
    const res = await asApproved(request(app).get(`/api/employer/jobs/${jobId}/close-impact`));
    expect(res.status).toBe(200);
    expect(typeof res.body.affectedApplicants).toBe('number');
  });

  it('refuses to edit a closed posting', async () => {
    const res = await asApproved(request(app).patch(`/api/employer/jobs/${jobId}`)).send({
      title: 'Changed while closed',
    });
    expect(res.status).toBe(409);
  });

  it('reopens into draft so the role goes back through review', async () => {
    const res = await asApproved(request(app).post(`/api/employer/jobs/${jobId}/reopen`));
    expect(res.status).toBe(200);
    expect(res.body.job.status).toBe('DRAFT');
    // Candidates auto-rejected by the close come back; before this they were
    // stranded permanently rejected with no route back.
    expect(typeof res.body.restoredApplications).toBe('number');
  });
});

describe('company profile', () => {
  it('saves the company introduction candidates will read', async () => {
    const res = await asApproved(request(app).patch('/api/employer/profile')).send({
      companyIntro:
        'We build pumping and fluid-handling systems for industrial and municipal customers across India.',
      sectorSlug: 'industrial-machinery-equipment',
      locations: ['pune', 'coimbatore'],
      website: 'https://kirloskar.example.com',
    });

    expect(res.status).toBe(200);
    expect(res.body.profile.sectorName).toBe('Industrial Machinery & Equipment');
    expect(res.body.profile.locations).toEqual(['pune', 'coimbatore']);
  });

  it('sends a verified company back for review when it renames itself', async () => {
    const { getDb } = await import('../src/db/client.js');
    const employerRepo = await import('../src/repositories/employer.repo.js');
    const me = await asApproved(request(app).get('/api/auth/me'));
    const profileId = employerRepo.findByUserId(me.body.id)!.id;
    getDb().prepare("UPDATE employer_profile SET account_status='APPROVED' WHERE id=?").run(profileId);

    const res = await asApproved(request(app).patch('/api/employer/profile')).send({
      companyName: 'Tata Motors Limited',
    });

    // The company name is what a shortlisted candidate is shown, so a verified
    // account must not be able to silently become a different brand.
    expect(res.body.requiresReapproval).toBe(true);
    expect(res.body.profile.accountStatus).toBe('SUBMITTED');
  });

  it('rejects a malformed website URL', async () => {
    const res = await asApproved(request(app).patch('/api/employer/profile')).send({
      website: 'not-a-url',
    });
    expect(res.status).toBe(400);
  });
});
