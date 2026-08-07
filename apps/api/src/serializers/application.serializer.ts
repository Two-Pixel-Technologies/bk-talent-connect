/**
 * Application serializers.
 *
 * The employer view is where the two privacy rules meet in one payload, so it
 * is built by composing the already-safe candidate employer view rather than by
 * spreading the application row and hoping nothing sensitive rides along.
 */

import {
  CANDIDATE_STAGE_LABEL,
  EMPLOYER_BUCKET_OF,
  type ApplicationStage,
  type EmployerBucket,
} from '@bktc/shared';
import type { ApplicationRow, ApplicationStageEventRow, Row } from '../db/rows.js';
import { unbrand } from '../db/rows.js';
import type { EmployerCandidateView } from './candidate.serializer.js';

export type StageEventView = {
  readonly fromStage: string | null;
  readonly toStage: string;
  readonly byRole: string;
  readonly note: string | null;
  readonly at: string;
};

/**
 * The internal timeline: admins only. Carries the note verbatim.
 */
export function toStageEventView(row: Row<ApplicationStageEventRow>): StageEventView {
  const e = unbrand(row);
  return {
    fromStage: e.from_stage,
    toStage: e.to_stage,
    byRole: e.changed_by_role,
    note: e.note,
    at: e.created_at,
  };
}

/**
 * The candidate's timeline. Same events, no free text.
 *
 * `note` is where an employer types their private assessment — "weak
 * communication, do not put forward again" — alongside the structured
 * outcomeReasonCode. Nothing in the field name or the API told them it was
 * candidate-visible, and it was: piped straight into the tracker they read.
 *
 * The whole product promise is that BK sits between the two parties and
 * controls what the candidate is told. Notification copy goes to real lengths
 * to keep even the employer's *name* out of candidate-facing text; this field
 * was carrying their opinion of the person. So the candidate gets the shape of
 * what happened and BK does the explaining, which is what they are paid for.
 */
export function toCandidateStageEventView(row: Row<ApplicationStageEventRow>): StageEventView {
  const e = unbrand(row);
  return {
    fromStage: e.from_stage,
    toStage: e.to_stage,
    byRole: e.changed_by_role,
    note: null,
    at: e.created_at,
  };
}

/**
 * The candidate's own view of an application.
 *
 * The company name is passed in only once the application has reached
 * shortlist — before that, listings are anonymous.
 */
export function toCandidateView(
  row: Row<ApplicationRow>,
  extra: {
    readonly jobTitle: string;
    readonly cityName: string | null;
    readonly sectorName: string | null;
    readonly employerName: string | null;
    readonly timeline: readonly StageEventView[];
  },
) {
  const a = unbrand(row);
  const stage = a.stage as ApplicationStage;
  return {
    id: a.id,
    jobId: a.job_id,
    jobTitle: extra.jobTitle,
    cityName: extra.cityName,
    sectorName: extra.sectorName,
    // null until shortlist — the reveal is part of the product, not an oversight.
    employerName: extra.employerName,
    stage,
    // Contract wording, not the internal enum: candidates were promised
    // Applied → Under Review → Shortlisted → Interview → Decision.
    stageLabel: CANDIDATE_STAGE_LABEL[stage],
    isRecommended: a.is_recommended === 1,
    appliedAt: a.applied_at,
    lastStageChangeAt: a.last_stage_change_at,
    timeline: extra.timeline,
  };
}

/**
 * What an employer sees about an applicant.
 *
 * `candidate` is an EmployerCandidateView, which already excludes salary, email
 * and mobile. Nothing here re-adds them.
 */
export function toEmployerView(
  row: Row<ApplicationRow>,
  candidate: EmployerCandidateView,
  extra: {
    readonly resumeFileId: string | null;
    /**
     * False while the candidate's profile is back in review.
     *
     * They used to be filtered out of the list entirely, which meant a
     * shortlisted person could silently disappear from an employer's board and
     * reappear later with nobody told — in a portal whose promise is "only
     * verified candidates", that reads as a bug at best. The row stays; the CV
     * link is withheld by the download route's own independent check.
     */
    readonly candidateAvailable: boolean;
  },
) {
  const a = unbrand(row);
  const stage = a.stage as ApplicationStage;
  return {
    id: a.id,
    candidate,
    // Four buckets, not the internal eleven-value enum — the contract showed
    // employers NEW / REVIEWING / INTERVIEW / DECISION.
    bucket: EMPLOYER_BUCKET_OF[stage] as EmployerBucket | null,
    stage,
    isRecommended: a.is_recommended === 1,
    appliedAt: a.applied_at,
    lastStageChangeAt: a.last_stage_change_at,
    /** The CV as it stood when they applied, not whatever is current. */
    resumeFileId: extra.candidateAvailable ? extra.resumeFileId : null,
    candidateAvailable: extra.candidateAvailable,
  };
}

export function toAdminView(
  row: Row<ApplicationRow>,
  extra: {
    readonly candidateName: string;
    readonly candidateProfileId: string;
    readonly jobTitle: string;
    readonly employerName: string;
    readonly timeline: readonly StageEventView[];
  },
) {
  const a = unbrand(row);
  const stage = a.stage as ApplicationStage;
  return {
    id: a.id,
    jobId: a.job_id,
    jobTitle: extra.jobTitle,
    employerName: extra.employerName,
    candidateProfileId: extra.candidateProfileId,
    candidateName: extra.candidateName,
    stage,
    source: a.source,
    isRecommended: a.is_recommended === 1,
    appliedAt: a.applied_at,
    lastStageChangeAt: a.last_stage_change_at,
    firstEmployerActionAt: a.first_employer_action_at,
    outcomeReasonCode: a.outcome_reason_code,
    timeline: extra.timeline,
  };
}
