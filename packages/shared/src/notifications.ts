/**
 * Notification events and their recipients.
 *
 * Transcribed from the Proposal p8 matrix rather than paraphrased — v1 of the
 * plan built this from a bullet list and contradicted the matrix (it notified
 * employers on new applications, which the matrix marks "–").
 *
 * lib/notify.ts and the P7 test suite are both driven from this table. Adding a
 * notification means adding a row here, not calling createNotification() ad hoc.
 *
 * Plan reference: HIGH-2, BLOCKER-2.
 */

import type { Role } from './enums.js';

/**
 * What a notification points at.
 *
 * Notifications store a subject, not a URL — the same event links somewhere
 * different for a candidate than for an admin, and a route rename would
 * otherwise orphan every historical row.
 */
export const NOTIFICATION_ENTITY_TYPES = [
  'CANDIDATE',
  'EMPLOYER',
  'JOB',
  'APPLICATION',
  'INTERVIEW',
] as const;
export type NotificationEntityType = (typeof NOTIFICATION_ENTITY_TYPES)[number];

export const NOTIFICATION_EVENTS = [
  'CANDIDATE_REGISTERED',
  'CANDIDATE_PROFILE_APPROVED',
  'CANDIDATE_PROFILE_CHANGES_REQUESTED',
  'EMPLOYER_ACCOUNT_APPROVED',
  'APPLICATION_SUBMITTED',
  'CANDIDATE_SHORTLISTED',
  'CANDIDATE_RECOMMENDED',
  'INTERVIEW_CONFIRMED',
  'OFFER_MADE',
  'CANDIDATE_NOT_SELECTED',
  'JOB_SUBMITTED',
  'JOB_APPROVED',
  'JOB_SENT_BACK',
  'EMPLOYER_PIPELINE_ACTION',
  'EMPLOYER_INTERVIEW_REQUESTED',
] as const;
export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

/**
 * Who receives a given event.
 * - CANDIDATE / EMPLOYER mean the parties attached to the subject record.
 * - ADMIN means every active admin, not a single seeded account.
 */
export interface NotificationSpec {
  readonly event: NotificationEvent;
  readonly recipients: readonly Role[];
  /** Matrix row this came from, or why it was added beyond the matrix. */
  readonly source: string;
}

export const NOTIFICATION_MATRIX: readonly NotificationSpec[] = [
  {
    event: 'CANDIDATE_REGISTERED',
    recipients: ['CANDIDATE', 'ADMIN'],
    source: 'p8 "Candidate registers" — candidate ✓Welcome, admin ✓Alert',
  },
  {
    event: 'CANDIDATE_PROFILE_APPROVED',
    recipients: ['CANDIDATE'],
    source: 'p8 "Profile approved by admin"',
  },
  {
    event: 'CANDIDATE_PROFILE_CHANGES_REQUESTED',
    recipients: ['CANDIDATE'],
    source: 'p8 "Profile needs changes" — carries the reason',
  },
  {
    event: 'EMPLOYER_ACCOUNT_APPROVED',
    recipients: ['EMPLOYER'],
    source: 'p8 "Employer account approved"',
  },
  {
    event: 'APPLICATION_SUBMITTED',
    recipients: ['CANDIDATE', 'ADMIN'],
    source: 'p8 "New application submitted" — employer column is "–", deliberately NOT notified',
  },
  {
    event: 'CANDIDATE_SHORTLISTED',
    recipients: ['CANDIDATE', 'EMPLOYER'],
    source: 'p8 "Candidate shortlisted"',
  },
  {
    event: 'INTERVIEW_CONFIRMED',
    recipients: ['CANDIDATE', 'EMPLOYER'],
    source: 'p8 "Interview confirmed" — both get details',
  },
  {
    event: 'OFFER_MADE',
    recipients: ['CANDIDATE', 'ADMIN'],
    source: 'p8 "Offer made"',
  },
  {
    event: 'CANDIDATE_NOT_SELECTED',
    recipients: ['CANDIDATE', 'ADMIN'],
    source: 'p8 "Candidate not selected"',
  },
  {
    event: 'JOB_SUBMITTED',
    recipients: ['EMPLOYER', 'ADMIN'],
    source: 'p8 "Job posting submitted" — employer ✓Pending, admin ✓Action',
  },
  {
    event: 'JOB_APPROVED',
    recipients: ['EMPLOYER'],
    source: 'p8 "Job posting approved & live"',
  },
  {
    event: 'JOB_SENT_BACK',
    recipients: ['EMPLOYER'],
    source: 'p8 "Job posting sent back" — carries admin comments',
  },

  // --- Beyond the p8 matrix, required by prose elsewhere in the proposal ----
  {
    event: 'EMPLOYER_PIPELINE_ACTION',
    recipients: ['ADMIN'],
    source: 'p6 bullet: "Admin is notified immediately on every employer action in the pipeline"',
  },
  {
    event: 'EMPLOYER_INTERVIEW_REQUESTED',
    recipients: ['ADMIN'],
    source: 'p6 REVIEWING column: employer "can request an interview"; BK then schedules it',
  },
  {
    event: 'CANDIDATE_RECOMMENDED',
    recipients: ['CANDIDATE'],
    source:
      'Not in the matrix. Added because admin recommendation shares a profile and CV with an employer the candidate never applied to — DPDP notice, and a good product moment.',
  },
] as const;

const BY_EVENT = new Map<NotificationEvent, NotificationSpec>(
  NOTIFICATION_MATRIX.map((spec) => [spec.event, spec]),
);

export function recipientsFor(event: NotificationEvent): readonly Role[] {
  const spec = BY_EVENT.get(event);
  if (!spec) throw new Error(`No notification spec for event ${event}`);
  return spec.recipients;
}

export function notifies(event: NotificationEvent, role: Role): boolean {
  return recipientsFor(event).includes(role);
}
