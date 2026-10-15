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
  'INTERVIEW_REMINDER',
  'OFFER_MADE',
  'OFFER_ACCEPTED',
  'OFFER_DECLINED',
  'CANDIDATE_JOINED',
  'CANDIDATE_NOT_SELECTED',
  'JOB_SUBMITTED',
  'JOB_APPROVED',
  'JOB_SENT_BACK',
  'EMPLOYER_PIPELINE_ACTION',
  'EMPLOYER_INTERVIEW_REQUESTED',
] as const;
export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

/** A delivery channel a notification event can go out on. */
export const NOTIFICATION_CHANNELS = ['PORTAL', 'EMAIL', 'WHATSAPP'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

/**
 * Who receives a given event.
 * - CANDIDATE / EMPLOYER mean the parties attached to the subject record.
 * - ADMIN means every active admin, not a single seeded account.
 */
export interface NotificationSpec {
  readonly event: NotificationEvent;
  readonly recipients: readonly Role[];
  /**
   * Which channels this event goes out on, for every recipient in
   * `recipients` uniformly — the proposal's p8 table does not vary channel
   * by recipient within a row, so neither does this. Drives both the portal
   * row (notify.ts only writes one when 'PORTAL' is listed — see
   * INTERVIEW_REMINDER, which the proposal marks Email+WhatsApp with no
   * portal entry) and the email/WhatsApp dispatch in lib/channels.ts.
   *
   * Rows added beyond the literal p8 matrix (see the "beyond the matrix"
   * groups below) default to PORTAL only: the proposal never specified a
   * channel for them, and inventing one would be a product decision this
   * file should not make silently.
   */
  readonly channels: readonly NotificationChannel[];
  /** Matrix row this came from, or why it was added beyond the matrix. */
  readonly source: string;
}

export const NOTIFICATION_MATRIX: readonly NotificationSpec[] = [
  {
    event: 'CANDIDATE_REGISTERED',
    recipients: ['CANDIDATE', 'ADMIN'],
    channels: ['EMAIL', 'PORTAL'],
    source: 'p8 "Candidate registers" — candidate ✓Welcome, admin ✓Alert. Channels: Email + Portal',
  },
  {
    event: 'CANDIDATE_PROFILE_APPROVED',
    recipients: ['CANDIDATE'],
    channels: ['EMAIL', 'WHATSAPP', 'PORTAL'],
    source: 'p8 "Profile approved by admin". Channels: Email + WhatsApp + Portal',
  },
  {
    event: 'CANDIDATE_PROFILE_CHANGES_REQUESTED',
    recipients: ['CANDIDATE'],
    channels: ['EMAIL', 'PORTAL'],
    source: 'p8 "Profile needs changes" — carries the reason. Channels: Email + Portal',
  },
  {
    event: 'EMPLOYER_ACCOUNT_APPROVED',
    recipients: ['EMPLOYER'],
    channels: ['EMAIL', 'PORTAL'],
    source: 'p8 "Employer account approved". Channels: Email + Portal',
  },
  {
    event: 'APPLICATION_SUBMITTED',
    recipients: ['CANDIDATE', 'ADMIN'],
    channels: ['EMAIL', 'WHATSAPP', 'PORTAL'],
    source: 'p8 "New application submitted" — employer column is "–", deliberately NOT notified. Channels: Email + WhatsApp + Portal',
  },
  {
    event: 'CANDIDATE_SHORTLISTED',
    recipients: ['CANDIDATE', 'EMPLOYER'],
    channels: ['EMAIL', 'WHATSAPP', 'PORTAL'],
    source: 'p8 "Candidate shortlisted". Channels: Email + WhatsApp + Portal',
  },
  {
    event: 'INTERVIEW_CONFIRMED',
    recipients: ['CANDIDATE', 'EMPLOYER'],
    channels: ['EMAIL', 'WHATSAPP', 'PORTAL'],
    source: 'p8 "Interview confirmed" — both get details. Channels: Email + WhatsApp + Portal',
  },
  {
    event: 'INTERVIEW_REMINDER',
    recipients: ['CANDIDATE', 'EMPLOYER'],
    channels: ['EMAIL', 'WHATSAPP'],
    source: 'p8 "Interview reminder (24 hrs)" — the one row with no Portal column. Channels: Email + WhatsApp only',
  },
  {
    event: 'OFFER_MADE',
    recipients: ['CANDIDATE', 'ADMIN'],
    channels: ['EMAIL', 'WHATSAPP', 'PORTAL'],
    source: 'p8 "Offer made". Channels: Email + WhatsApp + Portal',
  },
  {
    event: 'CANDIDATE_NOT_SELECTED',
    recipients: ['CANDIDATE', 'ADMIN'],
    channels: ['EMAIL', 'PORTAL'],
    source: 'p8 "Candidate not selected". Channels: Email + Portal',
  },

  // --- Beyond the p8 matrix: the candidate/employer-owned offer decision and
  // joining confirmation, added alongside the admin-coordination removal.
  // Same shape as the rows above — the acting party is excluded, the other
  // party and admin (read-only visibility) are told. Not in the proposal
  // table at all, so channels default to PORTAL only rather than guessing.
  {
    event: 'OFFER_ACCEPTED',
    recipients: ['EMPLOYER', 'ADMIN'],
    channels: ['PORTAL'],
    source: 'Added when the offer decision moved from admin to the candidate — the employer needs to know their offer was accepted.',
  },
  {
    event: 'OFFER_DECLINED',
    recipients: ['EMPLOYER', 'ADMIN'],
    channels: ['PORTAL'],
    source: 'Added when the offer decision moved from admin to the candidate — the employer needs to know their offer was declined.',
  },
  {
    event: 'CANDIDATE_JOINED',
    recipients: ['CANDIDATE', 'ADMIN'],
    channels: ['PORTAL'],
    source: 'Added when confirming JOINED moved from admin to the employer — the candidate is told their joining was recorded.',
  },
  {
    event: 'JOB_SUBMITTED',
    recipients: ['EMPLOYER', 'ADMIN'],
    channels: ['EMAIL', 'PORTAL'],
    source: 'p8 "Job posting submitted" — employer ✓Pending, admin ✓Action. Channels: Email + Portal',
  },
  {
    event: 'JOB_APPROVED',
    recipients: ['EMPLOYER'],
    channels: ['EMAIL', 'PORTAL'],
    source: 'p8 "Job posting approved & live". Channels: Email + Portal',
  },
  {
    event: 'JOB_SENT_BACK',
    recipients: ['EMPLOYER'],
    channels: ['EMAIL', 'PORTAL'],
    source: 'p8 "Job posting sent back" — carries admin comments. Channels: Email + Portal',
  },

  // --- Beyond the p8 matrix, required by prose elsewhere in the proposal ----
  // Neither row below has a channel in the proposal's table (they aren't in
  // it), so both stay PORTAL-only — admin is expected to be working inside
  // the portal, and this avoids inventing an email/WhatsApp requirement.
  {
    event: 'EMPLOYER_PIPELINE_ACTION',
    recipients: ['ADMIN'],
    channels: ['PORTAL'],
    source: 'p6 bullet: "Admin is notified immediately on every employer action in the pipeline"',
  },
  {
    event: 'EMPLOYER_INTERVIEW_REQUESTED',
    recipients: ['ADMIN'],
    channels: ['PORTAL'],
    source: 'p6 REVIEWING column: employer "can request an interview"; BK then schedules it',
  },
  {
    event: 'CANDIDATE_RECOMMENDED',
    recipients: ['CANDIDATE'],
    channels: ['PORTAL'],
    source:
      'Not in the matrix. Added because admin recommendation shares a profile and CV with an employer the candidate never applied to — DPDP notice, and a good product moment.',
  },
] as const;

const BY_EVENT = new Map<NotificationEvent, NotificationSpec>(
  NOTIFICATION_MATRIX.map((spec) => [spec.event, spec]),
);

export function channelsFor(event: NotificationEvent): readonly NotificationChannel[] {
  const spec = BY_EVENT.get(event);
  if (!spec) throw new Error(`No notification spec for event ${event}`);
  return spec.channels;
}

export function recipientsFor(event: NotificationEvent): readonly Role[] {
  const spec = BY_EVENT.get(event);
  if (!spec) throw new Error(`No notification spec for event ${event}`);
  return spec.recipients;
}

export function notifies(event: NotificationEvent, role: Role): boolean {
  return recipientsFor(event).includes(role);
}
