/**
 * DESIGN LAB — MOCK DATA ONLY.
 *
 * Shapes mirror the real production types (CandidateProfile in
 * features/candidate/use-profile.ts, BrowseJob/TrackedApplication in
 * features/candidate/use-jobs.ts, NotificationItem in
 * features/notifications/use-notifications.ts, ApplicationStage in
 * @bktc/shared) closely enough for realistic prototyping, but this file is
 * NOT wired to any API and must never be imported from production code.
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

/** Matches packages/shared/src/stages.ts CANDIDATE_TIMELINE_STEPS exactly. */
export const CANDIDATE_TIMELINE_STEPS = ['Applied', 'Under Review', 'Shortlisted', 'Interview', 'Decision'] as const;

/** Matches packages/shared/src/stages.ts CANDIDATE_STAGE_LABEL exactly. */
export const CANDIDATE_STAGE_LABEL: Record<ApplicationStage, string> = {
  APPLIED: 'Applied',
  UNDER_REVIEW: 'Under Review',
  SHORTLISTED: 'Shortlisted',
  INTERVIEW_SCHEDULED: 'Interview',
  INTERVIEWED: 'Interview',
  OFFER_MADE: 'Decision',
  OFFER_ACCEPTED: 'Decision',
  OFFER_DECLINED: 'Decision',
  JOINED: 'Decision',
  NOT_SELECTED: 'Decision',
  WITHDRAWN: 'Withdrawn',
};

/** Which of the 5 timeline steps is "current" for a given stage. */
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

export interface MockSkill {
  id: number;
  name: string;
}

export interface MockCandidate {
  fullName: string;
  approvalStatus: ApprovalStatus;
  completionPercent: number;
  currentJobTitle: string;
  currentEmployer: string;
  sectorName: string;
  functionName: string;
  cityName: string;
  yearsOfExperience: number;
  skills: MockSkill[];
  reviewNote?: string;
}

export interface MockJob {
  id: string;
  title: string;
  sectorName: string;
  functionName: string;
  cityName: string;
  state: string;
  workType: 'ONSITE' | 'HYBRID' | 'REMOTE';
  minExperience: number;
  maxExperience: number;
  numberOfPositions: number;
  publishedAt: string;
  hasApplied: boolean;
}

export interface MockApplication {
  id: string;
  jobTitle: string;
  companyName: string | null;
  cityName: string;
  stage: ApplicationStage;
  appliedAt: string;
  interview?: { date: string; time: string; mode: string };
}

export interface MockNotification {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

/** A mid-completion, approved profile — the most common "logged in" state. */
export const mockCandidate: MockCandidate = {
  fullName: 'Ananya Verma',
  approvalStatus: 'APPROVED',
  completionPercent: 82,
  currentJobTitle: 'Senior Process Engineer',
  currentEmployer: 'Reliance Industries',
  sectorName: 'Chemicals & Process',
  functionName: 'Process Engineering',
  cityName: 'Vadodara',
  yearsOfExperience: 6,
  skills: [
    { id: 1, name: 'Process Optimization' },
    { id: 2, name: 'Six Sigma' },
    { id: 3, name: 'SAP PM' },
    { id: 4, name: 'HAZOP' },
    { id: 5, name: 'DCS Operations' },
  ],
};

export const mockJobs: MockJob[] = [
  {
    id: 'job-1',
    title: 'Process Engineer II',
    sectorName: 'Chemicals & Process',
    functionName: 'Process Engineering',
    cityName: 'Vadodara',
    state: 'Gujarat',
    workType: 'ONSITE',
    minExperience: 4,
    maxExperience: 8,
    numberOfPositions: 2,
    publishedAt: '2026-08-20',
    hasApplied: false,
  },
  {
    id: 'job-2',
    title: 'Plant Reliability Lead',
    sectorName: 'Manufacturing & Machinery',
    functionName: 'Maintenance & Reliability',
    cityName: 'Pune',
    state: 'Maharashtra',
    workType: 'ONSITE',
    minExperience: 5,
    maxExperience: 10,
    numberOfPositions: 1,
    publishedAt: '2026-08-18',
    hasApplied: true,
  },
  {
    id: 'job-3',
    title: 'QA/QC Engineer',
    sectorName: 'Pharmaceuticals & Life Sciences',
    functionName: 'Quality Assurance',
    cityName: 'Ankleshwar',
    state: 'Gujarat',
    workType: 'ONSITE',
    minExperience: 3,
    maxExperience: 6,
    numberOfPositions: 3,
    publishedAt: '2026-08-24',
    hasApplied: false,
  },
  {
    id: 'job-4',
    title: 'HSE Manager',
    sectorName: 'Oil, Gas & Power',
    functionName: 'Health, Safety & Environment',
    cityName: 'Surat',
    state: 'Gujarat',
    workType: 'ONSITE',
    minExperience: 8,
    maxExperience: 14,
    numberOfPositions: 1,
    publishedAt: '2026-08-15',
    hasApplied: false,
  },
];

export const mockApplications: MockApplication[] = [
  {
    id: 'app-1',
    jobTitle: 'Process Engineer II',
    companyName: null,
    cityName: 'Vadodara',
    stage: 'SHORTLISTED',
    appliedAt: '2026-08-10',
  },
  {
    id: 'app-2',
    jobTitle: 'Plant Reliability Lead',
    companyName: 'Reveals after shortlist',
    cityName: 'Pune',
    stage: 'INTERVIEW_SCHEDULED',
    appliedAt: '2026-08-05',
    interview: { date: '2 Sep 2026', time: '11:00 AM', mode: 'Video call' },
  },
  {
    id: 'app-3',
    jobTitle: 'QA/QC Engineer',
    companyName: null,
    cityName: 'Ankleshwar',
    stage: 'UNDER_REVIEW',
    appliedAt: '2026-08-22',
  },
  {
    id: 'app-4',
    jobTitle: 'Maintenance Planner',
    companyName: null,
    cityName: 'Surat',
    stage: 'NOT_SELECTED',
    appliedAt: '2026-07-15',
  },
];

export const mockNotifications: MockNotification[] = [
  {
    id: 'notif-1',
    title: 'Application shortlisted',
    body: 'Your application for Process Engineer II moved to Shortlisted.',
    read: false,
    createdAt: '2026-08-29T10:00:00Z',
  },
  {
    id: 'notif-2',
    title: 'Interview scheduled',
    body: 'An interview has been scheduled for Plant Reliability Lead.',
    read: false,
    createdAt: '2026-08-28T15:30:00Z',
  },
  {
    id: 'notif-3',
    title: 'Profile approved',
    body: 'Your profile has been approved and is now visible to employers.',
    read: true,
    createdAt: '2026-08-20T09:00:00Z',
  },
];

export const mockStats = {
  activeApplications: mockApplications.filter((a) => a.stage !== 'WITHDRAWN' && a.stage !== 'NOT_SELECTED').length,
  shortlistedOrLater: mockApplications.filter((a) => STAGE_STEP_INDEX[a.stage] >= 2).length,
  interviews: mockApplications.filter((a) => a.stage === 'INTERVIEW_SCHEDULED' || a.stage === 'INTERVIEWED').length,
  unreadNotifications: mockNotifications.filter((n) => !n.read).length,
};
