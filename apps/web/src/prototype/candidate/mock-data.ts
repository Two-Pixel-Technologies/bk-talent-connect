/**
 * CANDIDATE PORTAL PROTOTYPE — MOCK DATA ONLY.
 *
 * Shapes mirror the real production types closely (CandidateProfile in
 * features/candidate/use-profile.ts, BrowseJob/TrackedApplication in
 * features/candidate/use-jobs.ts, NotificationItem in
 * features/notifications/use-notifications.ts, ApplicationStage/
 * CANDIDATE_TIMELINE_STEPS in @bktc/shared). Nothing here calls the API —
 * every page in this prototype reads/writes this in-memory data via React
 * state only. Never imported by, and never imports from, production code.
 */

export type ApprovalStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'CHANGES_REQUESTED' | 'REJECTED';

export type ApplicationStage =
  | 'APPLIED'
  | 'UNDER_REVIEW'
  | 'SHORTLISTED'
  | 'INTERVIEW_SCHEDULED'
  | 'INTERVIEWED'
  | 'OFFER_MADE'
  | 'OFFER_ACCEPTED'
  | 'OFFER_DECLINED'
  | 'JOINED'
  | 'NOT_SELECTED'
  | 'WITHDRAWN';

/** Matches packages/shared/src/stages.ts exactly. */
export const CANDIDATE_TIMELINE_STEPS = ['Applied', 'Under Review', 'Shortlisted', 'Interview', 'Decision'] as const;

export const CANDIDATE_STAGE_LABEL: Record<ApplicationStage, string> = {
  APPLIED: 'Applied',
  UNDER_REVIEW: 'Under Review',
  SHORTLISTED: 'Shortlisted',
  INTERVIEW_SCHEDULED: 'Interview Scheduled',
  INTERVIEWED: 'Interviewed',
  OFFER_MADE: 'Offer Made',
  OFFER_ACCEPTED: 'Offer Accepted',
  OFFER_DECLINED: 'Offer Declined',
  JOINED: 'Joined',
  NOT_SELECTED: 'Not Selected',
  WITHDRAWN: 'Withdrawn',
};

export const STAGE_STEP_INDEX: Record<ApplicationStage, number> = {
  APPLIED: 0,
  UNDER_REVIEW: 1,
  SHORTLISTED: 2,
  INTERVIEW_SCHEDULED: 3,
  INTERVIEWED: 3,
  OFFER_MADE: 4,
  OFFER_ACCEPTED: 4,
  OFFER_DECLINED: 4,
  JOINED: 4,
  NOT_SELECTED: 4,
  WITHDRAWN: -1,
};

export interface StageEvent {
  stage: ApplicationStage;
  at: string;
  note?: string;
}

export interface MockJob {
  id: string;
  title: string;
  department: string;
  sectorName: string;
  functionName: string;
  cityName: string;
  state: string;
  workType: 'ONSITE' | 'HYBRID' | 'REMOTE';
  minExperience: number;
  maxExperience: number;
  educationRequirement: string;
  numberOfPositions: number;
  publishedAt: string;
  description: string;
  requiredSkills: string[];
  goodToHaveSkills: string[];
}

export interface MockApplication {
  id: string;
  job: MockJob;
  stage: ApplicationStage;
  appliedAt: string;
  history: StageEvent[];
  interview?: { date: string; time: string; mode: 'Video call' | 'On-site' | 'Phone call'; location?: string; confirmed: boolean };
  company?: { name: string; sectorName: string; website: string; intro: string };
}

export type NotificationKind = 'STAGE' | 'INTERVIEW' | 'PROFILE' | 'JOB';

export interface MockNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  /** Which prototype route this notification opens when clicked. */
  linkTo?: string;
}

export interface MockExperience {
  id: number;
  company: string;
  title: string;
  startYear: number;
  endYear: number | null;
  isCurrent: boolean;
  keyAchievement: string | null;
}

export interface MockSkill {
  id: number;
  name: string;
}

export interface MockCandidate {
  fullName: string;
  email: string;
  mobile: string;
  approvalStatus: ApprovalStatus;
  completionPercent: number;
  reviewNote?: string;
  cityName: string;
  state: string;
  openToRelocation: boolean;
  currentJobTitle: string;
  currentEmployer: string;
  yearsOfExperience: number;
  sectorName: string;
  functionName: string;
  educationLevel: string;
  qualification: string;
  qualificationYear: number;
  careerSummary: string;
  noticePeriod: string;
  employmentPreference: string;
  currentSalaryLpa: number;
  expectedSalaryMinLpa: number;
  expectedSalaryMaxLpa: number;
  linkedinUrl: string;
  hasResume: boolean;
  skills: MockSkill[];
  experiences: MockExperience[];
}

/* ------------------------------------------------------------------------ */
/* Candidate                                                                 */
/* ------------------------------------------------------------------------ */

export const initialCandidate: MockCandidate = {
  fullName: 'Ananya Verma',
  email: 'ananya.verma@demo.in',
  mobile: '98XXXXXX21',
  approvalStatus: 'APPROVED',
  completionPercent: 86,
  cityName: 'Vadodara',
  state: 'Gujarat',
  openToRelocation: true,
  currentJobTitle: 'Senior Process Engineer',
  currentEmployer: 'Reliance Industries',
  yearsOfExperience: 6,
  sectorName: 'Chemicals & Process',
  functionName: 'Process Engineering',
  educationLevel: 'B.Tech',
  qualification: 'B.Tech Chemical Engineering',
  qualificationYear: 2018,
  careerSummary:
    'Process engineer with six years across specialty chemicals and API manufacturing. Led scale-up of two commercial products from pilot through full production, owns the HAZOP programme for our Vadodara block, and reduced batch cycle time by 14% through a crystallisation redesign.',
  noticePeriod: '30 days',
  employmentPreference: 'Full-time',
  currentSalaryLpa: 18,
  expectedSalaryMinLpa: 22,
  expectedSalaryMaxLpa: 28,
  linkedinUrl: 'linkedin.com/in/ananya-verma',
  hasResume: true,
  skills: [
    { id: 1, name: 'Process Optimization' },
    { id: 2, name: 'Six Sigma' },
    { id: 3, name: 'SAP PM' },
    { id: 4, name: 'HAZOP' },
    { id: 5, name: 'DCS Operations' },
    { id: 6, name: 'Process Safety' },
  ],
  experiences: [
    {
      id: 1,
      company: 'Reliance Industries',
      title: 'Senior Process Engineer',
      startYear: 2022,
      endYear: null,
      isCurrent: true,
      keyAchievement: 'Cut batch cycle time 14% through a crystallisation-stage redesign.',
    },
    {
      id: 2,
      company: 'Aarti Industries',
      title: 'Process Engineer',
      startYear: 2019,
      endYear: 2022,
      isCurrent: false,
      keyAchievement: 'Led HAZOP study for a greenfield production block.',
    },
    {
      id: 3,
      company: 'Gujarat Fluorochemicals',
      title: 'Graduate Engineer Trainee',
      startYear: 2018,
      endYear: 2019,
      isCurrent: false,
      keyAchievement: null,
    },
  ],
};

/* ------------------------------------------------------------------------ */
/* Jobs                                                                      */
/* ------------------------------------------------------------------------ */

export const mockJobs: MockJob[] = [
  {
    id: 'job-1',
    title: 'Process Engineer II',
    department: 'Production',
    sectorName: 'Chemicals & Process',
    functionName: 'Process Engineering',
    cityName: 'Vadodara',
    state: 'Gujarat',
    workType: 'ONSITE',
    minExperience: 4,
    maxExperience: 8,
    educationRequirement: 'B.Tech / B.E.',
    numberOfPositions: 2,
    publishedAt: '2026-08-20',
    description:
      'Own process design and scale-up for our specialty chemicals block, leading HAZOP studies and working with QA on documentation for regulated markets. Reports to the Head of Manufacturing.',
    requiredSkills: ['HAZOP', 'Process Safety', 'Scale-up'],
    goodToHaveSkills: ['DCS Operations', 'Six Sigma'],
  },
  {
    id: 'job-2',
    title: 'Plant Reliability Lead',
    department: 'Maintenance',
    sectorName: 'Manufacturing & Machinery',
    functionName: 'Maintenance & Reliability',
    cityName: 'Pune',
    state: 'Maharashtra',
    workType: 'ONSITE',
    minExperience: 5,
    maxExperience: 10,
    educationRequirement: 'Diploma / B.E.',
    numberOfPositions: 1,
    publishedAt: '2026-08-18',
    description:
      'Take ownership of rotating equipment reliability across the plant — pumps, gearboxes, compressors. Build out the condition-monitoring programme and run the planned maintenance schedule.',
    requiredSkills: ['Preventive Maintenance', 'Root Cause Analysis'],
    goodToHaveSkills: ['Hydraulics', 'SAP PM'],
  },
  {
    id: 'job-3',
    title: 'QA/QC Engineer',
    department: 'Quality',
    sectorName: 'Pharmaceuticals & Life Sciences',
    functionName: 'Quality Assurance',
    cityName: 'Ankleshwar',
    state: 'Gujarat',
    workType: 'ONSITE',
    minExperience: 3,
    maxExperience: 6,
    educationRequirement: 'B.Pharm / B.Tech',
    numberOfPositions: 3,
    publishedAt: '2026-08-24',
    description:
      'Handle batch record review, deviation investigation and CAPA closure in a regulated API facility. Support regulatory inspections and maintain the site validation master plan.',
    requiredSkills: ['GMP', 'Quality Assurance'],
    goodToHaveSkills: ['Deviation Investigation', 'cGMP'],
  },
  {
    id: 'job-4',
    title: 'HSE Manager',
    department: 'Safety',
    sectorName: 'Oil, Gas & Power',
    functionName: 'Health, Safety & Environment',
    cityName: 'Surat',
    state: 'Gujarat',
    workType: 'ONSITE',
    minExperience: 8,
    maxExperience: 14,
    educationRequirement: 'B.Tech + HSE Diploma',
    numberOfPositions: 1,
    publishedAt: '2026-08-15',
    description:
      'Lead the site HSE programme across a large process facility — incident investigation, permit-to-work systems, and the safety culture programme for a 400-person site.',
    requiredSkills: ['HSE Management', 'Incident Investigation'],
    goodToHaveSkills: ['ISO 45001', 'Process Safety'],
  },
  {
    id: 'job-5',
    title: 'Automation Engineer',
    department: 'Instrumentation',
    sectorName: 'Industrial Automation & Instrumentation',
    functionName: 'Automation & Controls',
    cityName: 'Hyderabad',
    state: 'Telangana',
    workType: 'HYBRID',
    minExperience: 2,
    maxExperience: 5,
    educationRequirement: 'B.Tech Instrumentation',
    numberOfPositions: 2,
    publishedAt: '2026-08-27',
    description:
      'Work on PLC and SCADA systems for process plants — IO schedules through to on-site commissioning. Deepen the safety-instrumented-systems programme alongside two senior engineers.',
    requiredSkills: ['PLC', 'SCADA'],
    goodToHaveSkills: ['Siemens PLC', 'HMI'],
  },
  {
    id: 'job-6',
    title: 'Production Shift Manager',
    department: 'Production',
    sectorName: 'Chemicals & Process',
    functionName: 'Production',
    cityName: 'Ankleshwar',
    state: 'Gujarat',
    workType: 'ONSITE',
    minExperience: 6,
    maxExperience: 12,
    educationRequirement: 'B.Tech Chemical',
    numberOfPositions: 1,
    publishedAt: '2026-08-30',
    description:
      'Own shift production targets, safety compliance and team coordination across a three-shift specialty chemicals unit. Work closely with process engineering on continuous improvement.',
    requiredSkills: ['Production Planning', 'Team Leadership'],
    goodToHaveSkills: ['Six Sigma', 'SAP PM'],
  },
  {
    id: 'job-7',
    title: 'Utilities Engineer',
    department: 'Utilities',
    sectorName: 'Manufacturing & Machinery',
    functionName: 'Maintenance & Reliability',
    cityName: 'Vadodara',
    state: 'Gujarat',
    workType: 'ONSITE',
    minExperience: 3,
    maxExperience: 7,
    educationRequirement: 'Diploma / B.E.',
    numberOfPositions: 2,
    publishedAt: '2026-08-29',
    description:
      'Manage boiler, compressor and cooling-tower operations for a large process site, with a focus on energy efficiency and preventive maintenance scheduling.',
    requiredSkills: ['Utilities Operations', 'Preventive Maintenance'],
    goodToHaveSkills: ['Energy Efficiency'],
  },
];

/* ------------------------------------------------------------------------ */
/* Applications                                                              */
/* ------------------------------------------------------------------------ */

export const initialApplications: MockApplication[] = [
  {
    id: 'app-1',
    job: mockJobs[0]!,
    stage: 'SHORTLISTED',
    appliedAt: '2026-08-10',
    history: [
      { stage: 'APPLIED', at: '2026-08-10T09:12:00Z' },
      { stage: 'UNDER_REVIEW', at: '2026-08-14T11:00:00Z' },
      { stage: 'SHORTLISTED', at: '2026-08-22T15:40:00Z', note: 'Moved forward after profile review.' },
    ],
  },
  {
    id: 'app-2',
    job: mockJobs[1]!,
    stage: 'INTERVIEW_SCHEDULED',
    appliedAt: '2026-08-05',
    history: [
      { stage: 'APPLIED', at: '2026-08-05T10:00:00Z' },
      { stage: 'UNDER_REVIEW', at: '2026-08-08T09:30:00Z' },
      { stage: 'SHORTLISTED', at: '2026-08-15T14:00:00Z' },
      { stage: 'INTERVIEW_SCHEDULED', at: '2026-08-28T16:20:00Z', note: 'Panel interview with plant head.' },
    ],
    interview: { date: '2 Sep 2026', time: '11:00 AM', mode: 'Video call', confirmed: false },
    company: {
      name: 'Kirloskar Systems',
      sectorName: 'Manufacturing & Machinery',
      website: 'kirloskarsystems.example',
      intro: 'Pumping and fluid-handling systems for industrial and municipal customers, manufacturing in Pune and Coimbatore.',
    },
  },
  {
    id: 'app-3',
    job: mockJobs[2]!,
    stage: 'UNDER_REVIEW',
    appliedAt: '2026-08-22',
    history: [
      { stage: 'APPLIED', at: '2026-08-22T08:45:00Z' },
      { stage: 'UNDER_REVIEW', at: '2026-08-25T10:15:00Z' },
    ],
  },
  {
    id: 'app-4',
    job: mockJobs[3]!,
    stage: 'NOT_SELECTED',
    appliedAt: '2026-07-15',
    history: [
      { stage: 'APPLIED', at: '2026-07-15T09:00:00Z' },
      { stage: 'UNDER_REVIEW', at: '2026-07-18T09:00:00Z' },
      { stage: 'NOT_SELECTED', at: '2026-07-30T09:00:00Z', note: 'The role was filled by an internal transfer.' },
    ],
  },
];

/* ------------------------------------------------------------------------ */
/* Notifications                                                             */
/* ------------------------------------------------------------------------ */

export const initialNotifications: MockNotification[] = [
  {
    id: 'notif-1',
    kind: 'STAGE',
    title: 'Application shortlisted',
    body: 'Your application for Process Engineer II moved to Shortlisted.',
    read: false,
    createdAt: '2026-08-29T10:00:00Z',
    linkTo: '/prototype/candidate/applications/app-1',
  },
  {
    id: 'notif-2',
    kind: 'INTERVIEW',
    title: 'Interview scheduled',
    body: 'An interview has been scheduled for Plant Reliability Lead on 2 Sep, 11:00 AM.',
    read: false,
    createdAt: '2026-08-28T15:30:00Z',
    linkTo: '/prototype/candidate/applications/app-2',
  },
  {
    id: 'notif-3',
    kind: 'JOB',
    title: 'New role matches your profile',
    body: 'Automation Engineer in Hyderabad matches your sector and function preferences.',
    read: false,
    createdAt: '2026-08-27T09:00:00Z',
    linkTo: '/prototype/candidate/jobs/job-5',
  },
  {
    id: 'notif-4',
    kind: 'PROFILE',
    title: 'Profile approved',
    body: 'Your profile has been approved and is now visible to employers.',
    read: true,
    createdAt: '2026-08-20T09:00:00Z',
    linkTo: '/prototype/candidate/profile',
  },
  {
    id: 'notif-5',
    kind: 'STAGE',
    title: 'Application update',
    body: 'Your application for HSE Manager was not taken forward this time.',
    read: true,
    createdAt: '2026-07-30T09:00:00Z',
    linkTo: '/prototype/candidate/applications/app-4',
  },
];
