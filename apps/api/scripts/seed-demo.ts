/**
 * Demo dataset.
 *
 * Realistic accounts in every state so the portal can be walked through without
 * filling forms first — and so a client walkthrough shows the approval gates
 * actually doing something rather than a series of empty screens.
 *
 * Never run against production: it creates accounts with known passwords.
 *
 *   npm run seed:demo
 */

import { getDb, closeDatabase } from '../src/db/client.js';
import { migrate } from '../src/db/migrate.js';
import { seed as seedTaxonomy } from '../src/db/seed.js';
import * as userRepo from '../src/repositories/user.repo.js';
import * as candidateRepo from '../src/repositories/candidate.repo.js';
import * as employerRepo from '../src/repositories/employer.repo.js';
import * as taxonomyRepo from '../src/repositories/taxonomy.repo.js';
import { hashPassword } from '../src/lib/password.js';
import { env } from '../src/config/env.js';
import * as jobRepo from '../src/repositories/job.repo.js';
import * as applicationRepo from '../src/repositories/application.repo.js';
import * as events from '../src/modules/notification/notification-events.js';
import { lpaToRupees, nowIso } from '@bktc/shared';

const JOBS = [
  {
    title: 'Senior Process Engineer',
    department: 'Production',
    positions: 2,
    sector: 'pharmaceuticals-life-sciences',
    fn: 'process-engineering',
    city: 'pune',
    state: 'Maharashtra',
    workType: 'ONSITE',
    minExp: 5,
    maxExp: 10,
    education: 'BTECH',
    bandMin: 20,
    bandMax: 28,
    status: 'APPROVED',
    skills: ['HAZOP', 'Process Safety', 'GMP', 'Scale-up'],
    description:
      'You will own scale-up and process safety for our API block in Pune. That means leading HAZOP studies, owning the process design basis for products moving from pilot to commercial scale, and working alongside QA and regulatory on documentation for regulated markets. The role reports to the Head of Manufacturing and has two direct reports. We run a modern plant with DCS control throughout and have invested heavily in automation over the last three years. You will be involved from the earliest technology transfer discussions through to commercial production, so this is genuine ownership rather than executing someone else plan. We are looking for someone comfortable presenting to auditors and driving cross-functional projects to completion without close supervision, who enjoys solving problems on the shop floor as much as at a desk.',
  },
  {
    title: 'Maintenance Engineer - Rotating Equipment',
    department: 'Maintenance',
    positions: 1,
    sector: 'industrial-machinery-equipment',
    fn: 'maintenance-reliability',
    city: 'coimbatore',
    state: 'Tamil Nadu',
    workType: 'ONSITE',
    minExp: 3,
    maxExp: 7,
    education: 'DIPLOMA',
    bandMin: 8,
    bandMax: 13,
    status: 'APPROVED',
    skills: ['Preventive Maintenance', 'Hydraulics', 'Root Cause Analysis'],
    description:
      'We are looking for a maintenance engineer to take ownership of rotating equipment across our Coimbatore works - pumps, gearboxes, compressors and the associated drive trains. You will run the planned maintenance schedule, lead breakdown response, and build out the condition monitoring programme we started last year. Roughly forty percent of the role is hands-on and the rest is planning, spares management and working with the production team on availability. We would like someone who is not satisfied with fixing the same failure twice and who will push root cause work through to a permanent fix. There is a clear route into a reliability lead position for the right person, and we support external certification.',
  },
  {
    title: 'Design Engineer - Sheet Metal',
    department: 'Design',
    positions: 3,
    sector: 'automobile-auto-components',
    fn: 'design-drafting',
    city: 'chakan',
    state: 'Maharashtra',
    workType: 'ONSITE',
    minExp: 2,
    maxExp: 6,
    education: 'BE',
    bandMin: 6,
    bandMax: 11,
    status: 'PENDING_APPROVAL',
    skills: ['SolidWorks', 'GD&T', 'Sheet Metal Design'],
    description:
      'Join our design team at Chakan working on sheet metal assemblies for commercial vehicle customers. You will take designs from concept through to production drawings, run tolerance stack-ups, and work directly with our tool room on manufacturability before anything is committed to tooling. Most of our work is build-to-print with increasing design responsibility as customers involve us earlier, so there is real scope to influence the product rather than just document it. We use SolidWorks throughout and have recently moved to a managed PDM setup. Ideal candidates have spent time on a shop floor and understand what is genuinely manufacturable rather than only what passes an FEA run.',
  },
];

const PASSWORD = 'demo-password-1';

type DemoCandidate = {
  email: string;
  fullName: string;
  mobile: string;
  city: string;
  state: string;
  title: string;
  employer: string;
  years: number;
  sector: string;
  fn: string;
  education: string;
  qualification: string;
  qualYear: number;
  summary: string;
  notice: string;
  currentLpa: number;
  minLpa: number;
  maxLpa: number;
  skills: string[];
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'CHANGES_REQUESTED';
  reviewNote?: string;
};

const CANDIDATES: DemoCandidate[] = [
  {
    email: 'anita.desai@demo.in',
    fullName: 'Anita Desai',
    mobile: '9876543210',
    city: 'pune',
    state: 'Maharashtra',
    title: 'Senior Process Engineer',
    employer: 'Thermax',
    years: 8,
    sector: 'pharmaceuticals-life-sciences',
    fn: 'process-engineering',
    education: 'BTECH',
    qualification: 'B.Tech Chemical Engineering',
    qualYear: 2017,
    summary:
      'Process engineer with eight years across API manufacturing and formulation plants. I have led scale-up of three commercial products from pilot through to full production, owned the HAZOP study for a greenfield block, and cut batch cycle time by 18% by redesigning the crystallisation stage. Comfortable owning regulatory documentation end to end and working directly with USFDA auditors.',
    notice: 'D30',
    currentLpa: 18,
    minLpa: 24,
    maxLpa: 30,
    skills: ['HAZOP', 'Process Safety', 'GMP', 'Scale-up', 'Process Control'],
    status: 'APPROVED',
  },
  {
    email: 'rohit.kulkarni@demo.in',
    fullName: 'Rohit Kulkarni',
    mobile: '9823012345',
    city: 'nashik',
    state: 'Maharashtra',
    title: 'Design Engineer',
    employer: 'Mahindra CIE',
    years: 5,
    sector: 'automobile-auto-components',
    fn: 'design-drafting',
    education: 'BE',
    qualification: 'B.E. Mechanical Engineering',
    qualYear: 2020,
    summary:
      'Mechanical design engineer working on sheet metal and machined components for commercial vehicle assemblies. I own designs from concept through to production drawings, run tolerance stack-ups, and work closely with the tool room on manufacturability. Recently took a bracket family from 11 parts down to 4 through redesign, saving roughly 14% on assembly cost.',
    notice: 'D60',
    currentLpa: 9,
    minLpa: 13,
    maxLpa: 16,
    skills: ['SolidWorks', 'GD&T', 'Sheet Metal Design', 'Tool Design', 'AutoCAD'],
    status: 'SUBMITTED',
  },
  {
    email: 'priya.nair@demo.in',
    fullName: 'Priya Nair',
    mobile: '9945566778',
    city: 'bengaluru',
    state: 'Karnataka',
    title: 'QA Executive',
    employer: 'Biocon',
    years: 4,
    sector: 'biotechnology',
    fn: 'quality-assurance-control',
    education: 'MTECH',
    qualification: 'M.Tech Biotechnology',
    qualYear: 2021,
    summary:
      'Quality assurance executive in a biologics facility, handling batch record review, deviation investigation and CAPA closure. I have supported two regulatory inspections and maintain the site validation master plan. My focus is on making quality systems something the shop floor can actually follow rather than paperwork bolted on afterwards.',
    notice: 'IMMEDIATE',
    currentLpa: 11,
    minLpa: 15,
    maxLpa: 19,
    skills: ['GMP', 'Quality Assurance', 'Method Validation', 'Deviation Investigation', 'cGMP'],
    status: 'APPROVED',
  },
  {
    email: 'sameer.joshi@demo.in',
    fullName: 'Sameer Joshi',
    mobile: '9812233445',
    city: 'ahmedabad',
    state: 'Gujarat',
    title: 'Maintenance Engineer',
    employer: 'Adani Power',
    years: 6,
    sector: 'power-renewable-energy',
    fn: 'maintenance-reliability',
    education: 'DIPLOMA',
    qualification: 'Diploma in Electrical Engineering',
    qualYear: 2018,
    summary:
      'Maintenance engineer on a 660MW thermal unit, responsible for planned and breakdown maintenance across auxiliaries. I introduced condition monitoring on critical pumps which cut unplanned outages materially over two years. Strong on switchgear, drives and root cause work.',
    notice: 'D90',
    currentLpa: 8,
    minLpa: 11,
    maxLpa: 14,
    skills: ['Preventive Maintenance', 'Switchgear', 'Root Cause Analysis', 'Hydraulics'],
    status: 'CHANGES_REQUESTED',
    reviewNote:
      'Thanks Sameer. Could you add your two most recent roles under Career history, and expand the summary to cover the condition-monitoring project in more detail? That is the strongest thing on your profile and it deserves more space.',
  },
  {
    email: 'fatima.shaikh@demo.in',
    fullName: 'Fatima Shaikh',
    mobile: '9700011223',
    city: 'hyderabad',
    state: 'Telangana',
    title: 'Automation Engineer',
    employer: 'Honeywell',
    years: 3,
    sector: 'industrial-automation-instrumentation',
    fn: 'automation-controls',
    education: 'BTECH',
    qualification: 'B.Tech Instrumentation',
    qualYear: 2022,
    summary:
      'Automation engineer working on PLC and SCADA systems for process plants. I handle everything from IO schedules through to commissioning on site, and have delivered four brownfield migrations without unplanned downtime. Currently deepening my work on safety instrumented systems.',
    notice: 'D30',
    currentLpa: 7,
    minLpa: 10,
    maxLpa: 13,
    skills: ['PLC', 'SCADA', 'Siemens PLC', 'Instrumentation', 'HMI'],
    status: 'DRAFT',
  },
];

const EMPLOYERS = [
  {
    email: 'ravi.menon@kirloskar.demo.in',
    company: 'Kirloskar Systems',
    contact: 'Ravi Menon',
    phone: '9820011122',
    sector: 'industrial-machinery-equipment',
    intro:
      'We build pumping and fluid-handling systems for industrial and municipal customers across India, with manufacturing in Pune and Coimbatore.',
    status: 'APPROVED' as const,
  },
  {
    email: 'neha.gupta@zydus.demo.in',
    company: 'Zydus Lifesciences',
    contact: 'Neha Gupta',
    phone: '9898776655',
    sector: 'pharmaceuticals-life-sciences',
    intro:
      'A research-driven pharmaceutical company with formulation and API sites across Gujarat, supplying regulated markets worldwide.',
    status: 'SUBMITTED' as const,
  },
];

async function main(): Promise<void> {
  if (env.isProduction) {
    console.error('Refusing to seed demo data in production.');
    process.exit(1);
  }

  const db = getDb();
  migrate({ db, silent: true });
  seedTaxonomy(db, { silent: true });

  const passwordHash = await hashPassword(PASSWORD);
  const adminHash = await hashPassword('bktc-admin-2026');

  // --- Admin ---------------------------------------------------------------
  if (!userRepo.emailExists('admin@bktalentconnect.com')) {
    userRepo.create({ email: 'admin@bktalentconnect.com', passwordHash: adminHash, role: 'ADMIN' });
  }

  // --- Candidates ----------------------------------------------------------
  for (const c of CANDIDATES) {
    if (userRepo.emailExists(c.email)) continue;

    const userId = userRepo.create({ email: c.email, passwordHash, role: 'CANDIDATE' });
    const profileId = candidateRepo.create({
      userId,
      fullName: c.fullName,
      mobile: c.mobile,
      consentVersion: '2026-08-v1',
    });

    candidateRepo.updateFields(profileId, {
      city_id: taxonomyRepo.idBySlug('city', c.city),
      state: c.state,
      open_to_relocation: 1,
      current_job_title: c.title,
      current_employer: c.employer,
      years_of_experience: c.years,
      sector_id: taxonomyRepo.idBySlug('sector', c.sector),
      functional_area_id: taxonomyRepo.idBySlug('functional_area', c.fn),
      education_level: c.education,
      qualification: c.qualification,
      qualification_year: c.qualYear,
      career_summary: c.summary,
      notice_period: c.notice,
      employment_preference: 'FULL_TIME',
      current_salary: lpaToRupees(c.currentLpa),
      expected_salary_min: lpaToRupees(c.minLpa),
      expected_salary_max: lpaToRupees(c.maxLpa),
      completion_percent: c.status === 'DRAFT' ? 62 : 90,
    });

    candidateRepo.replaceSkills(
      profileId,
      c.skills.map((s) => taxonomyRepo.resolveSkillId(s)),
    );

    candidateRepo.replaceExperiences(profileId, [
      {
        company: c.employer,
        title: c.title,
        startYear: new Date().getFullYear() - Math.min(c.years, 4),
        endYear: null,
        isCurrent: true,
        domainTags: [],
        keyAchievement: null,
      },
    ]);

    if (c.status !== 'DRAFT') {
      candidateRepo.setStatus(profileId, c.status, { submittedAt: nowIso() });
    }
    if (c.reviewNote) {
      candidateRepo.updateFields(profileId, {});
      db.prepare('UPDATE candidate_profile SET review_note = ?, reviewed_at = ? WHERE id = ?').run(
        c.reviewNote,
        nowIso(),
        profileId,
      );
    }
  }

  // --- Employers -----------------------------------------------------------
  for (const e of EMPLOYERS) {
    if (userRepo.emailExists(e.email)) continue;

    const userId = userRepo.create({ email: e.email, passwordHash, role: 'EMPLOYER' });
    const profileId = employerRepo.create({
      userId,
      companyName: e.company,
      hrContactName: e.contact,
      hrContactEmail: e.email,
      hrContactPhone: e.phone,
    });

    db.prepare(
      `UPDATE employer_profile
       SET sector_id = ?, company_intro = ?, locations = ?, account_status = ?, updated_at = ?
       WHERE id = ?`,
    ).run(
      taxonomyRepo.idBySlug('sector', e.sector),
      e.intro,
      JSON.stringify(['pune', 'ahmedabad']),
      e.status,
      nowIso(),
      profileId,
    );
  }

  // --- Jobs -----------------------------------------------------------------
  const kirloskar = db
    .prepare("SELECT id FROM employer_profile WHERE company_name = 'Kirloskar Systems'")
    .get() as { id: string } | undefined;

  if (kirloskar) {
    const existing = db
      .prepare('SELECT count(*) AS n FROM job WHERE employer_profile_id = ?')
      .get(kirloskar.id) as { n: number };

    if (existing.n === 0) {
      for (const j of JOBS) {
        const jobId = jobRepo.create(kirloskar.id, j.title);
        jobRepo.updateFields(jobId, {
          department: j.department,
          number_of_positions: j.positions,
          sector_id: taxonomyRepo.idBySlug('sector', j.sector),
          functional_area_id: taxonomyRepo.idBySlug('functional_area', j.fn),
          city_id: taxonomyRepo.idBySlug('city', j.city),
          state: j.state,
          work_type: j.workType,
          min_experience: j.minExp,
          max_experience: j.maxExp,
          education_requirement: j.education,
          description: j.description,
          salary_band_min: lpaToRupees(j.bandMin),
          salary_band_max: lpaToRupees(j.bandMax),
        });
        jobRepo.replaceSkills(jobId, 'REQUIRED', j.skills.map((s) => taxonomyRepo.resolveSkillId(s)));
        if (j.status !== 'DRAFT') {
          jobRepo.setStatus(jobId, j.status, ['DRAFT'], {
            publishedAt: j.status === 'APPROVED' ? nowIso() : null,
          });
        }
      }
    }
  }

  // --- Applications ---------------------------------------------------------
  // A pipeline in several states, so the employer list and the candidate
  // tracker both have something real to show.
  const liveJobs = db
    .prepare("SELECT id, title FROM job WHERE status = 'APPROVED' ORDER BY created_at")
    .all() as { id: string; title: string }[];

  const approvedCandidates = db
    .prepare("SELECT id, full_name, resume_file_id FROM candidate_profile WHERE profile_status = 'APPROVED'")
    .all() as { id: string; full_name: string; resume_file_id: string | null }[];

  const existingApplications = (
    db.prepare('SELECT count(*) AS n FROM application').get() as { n: number }
  ).n;

  if (existingApplications === 0 && liveJobs.length > 0 && approvedCandidates.length > 0) {
    const stages = ['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED'];
    approvedCandidates.forEach((candidate, index) => {
      const job = liveJobs[index % liveJobs.length]!;
      const applicationId = applicationRepo.create({
        jobId: job.id,
        candidateProfileId: candidate.id,
        source: 'APPLIED',
        resumeFileId: candidate.resume_file_id,
      });
      applicationRepo.recordStageEvent({
        applicationId,
        fromStage: null,
        toStage: 'APPLIED',
        changedById: null,
        changedByRole: 'CANDIDATE',
      });

      // Walk a couple of them along so the pipeline is not all at one stage.
      const target = stages[index % stages.length]!;
      let current = 'APPLIED';
      for (const next of ['UNDER_REVIEW', 'SHORTLISTED']) {
        if (stages.indexOf(next) > stages.indexOf(target)) break;
        applicationRepo.setStage(applicationId, next as never, current as never);
        applicationRepo.recordStageEvent({
          applicationId,
          fromStage: current,
          toStage: next,
          changedById: null,
          changedByRole: 'EMPLOYER',
        });
        current = next;
      }
    });
  }

  /*
   * Notifications for the demo.
   *
   * The seed writes rows directly rather than going through the services, so
   * nothing above raises a notification — which leaves BK looking at an empty
   * bell on the one screen that is supposed to show the portal keeping people
   * informed. These go through the real events module, so the copy and the
   * recipients are the same ones production would produce.
   */
  const seeded = db
    .prepare("SELECT id FROM application ORDER BY created_at LIMIT 3")
    .all() as { id: string }[];

  const existingNotifications = (
    db.prepare('SELECT count(*) AS n FROM notification').get() as { n: number }
  ).n;

  if (existingNotifications === 0) {
    for (const { id } of seeded) events.applicationSubmitted(id);
    for (const { id } of seeded.slice(0, 2)) {
      events.stageChanged({
        applicationId: id,
        toStage: 'SHORTLISTED',
        actorId: '',
        actorRole: 'ADMIN',
      });
    }
  }

  console.log('\nDemo data ready.\n');
  console.log('  Admin      admin@bktalentconnect.com / bktc-admin-2026');
  console.log(`  Candidates (password: ${PASSWORD})`);
  for (const c of CANDIDATES) console.log(`    ${c.email.padEnd(32)} ${c.status}`);
  console.log(`  Employers  (password: ${PASSWORD})`);
  for (const e of EMPLOYERS) console.log(`    ${e.email.padEnd(32)} ${e.status}`);
  console.log('');

  closeDatabase();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
