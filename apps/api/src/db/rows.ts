/**
 * Row types — the TypeScript mirror of the SQL schema.
 *
 * Two things make this file load-bearing:
 *
 * 1. BRANDING. Every row type carries an unexported phantom property, so
 *    `res.json(row)` is a type error. The only way to strip the brand is to
 *    pass the row through a serializer, which is what keeps candidate salaries
 *    and job salary bands out of responses. A convention would not survive a
 *    new endpoint added eight months into the support year; a type error will.
 *
 * 2. DRIFT. Hand-written types silently diverge from the schema — rename a
 *    column in a migration and this file still compiles, then fails at runtime
 *    as `undefined`. TABLE_COLUMNS below is checked against PRAGMA table_info
 *    for every table by tests/schema-parity.test.ts.
 *
 * Plan reference: HIGH-20, and the schema-parity guard.
 */

declare const unserialized: unique symbol;

/** Marks a value as raw database output that must not be sent to a client. */
export type Row<T> = T & { readonly [unserialized]?: never };

/** Strips the brand. Only serializers should call this. */
export function unbrand<T>(row: Row<T>): T {
  return row as T;
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

/**
 * @public One row type per table is the invariant this file exists to hold.
 * `review_status` is a lookup read through joins rather than a repository, so nothing
 * imports the type — but a schema mirror with gaps in it is not a mirror, and
 * the parity test's value comes from the set being complete.
 */
export type ReviewStatusRow = Row<{
  code: string;
  label: string;
  sort_order: number;
}>;

/**
 * @public One row type per table is the invariant this file exists to hold.
 * `job_status` is a lookup read through joins rather than a repository, so nothing
 * imports the type — but a schema mirror with gaps in it is not a mirror, and
 * the parity test's value comes from the set being complete.
 */
export type JobStatusRow = Row<{
  code: string;
  label: string;
  sort_order: number;
  is_public: number;
}>;

/**
 * @public One row type per table is the invariant this file exists to hold.
 * `application_stage` is a lookup read through joins rather than a repository, so nothing
 * imports the type — but a schema mirror with gaps in it is not a mirror, and
 * the parity test's value comes from the set being complete.
 */
export type ApplicationStageRow = Row<{
  code: string;
  label: string;
  sort_order: number;
}>;

export type TaxonomyRow = Row<{
  id: number;
  slug: string;
  name: string;
  sort_order: number;
  is_active: number;
}>;

/** Cities carry a state so City can be filtered by the selected State. */
export type CityRow = Row<{
  id: number;
  slug: string;
  name: string;
  /** NULL for "Other", which is offered in every state. */
  state: string | null;
  sort_order: number;
  is_active: number;
}>;

export type SkillRow = Row<{
  id: number;
  slug: string;
  name: string;
  is_approved: number;
  created_at: string;
}>;

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export type UserRow = Row<{
  id: string;
  email: string;
  password_hash: string;
  role: string;
  status: string;
  must_change_password: number;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}>;

export type SessionRow = Row<{
  id: string;
  token_hash: string;
  user_id: string;
  expires_at: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}>;

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

export type FileAssetRow = Row<{
  id: string;
  owner_id: string;
  kind: string;
  original_name: string;
  stored_path: string;
  mime_type: string;
  size_bytes: number;
  checksum: string;
  created_at: string;
  deleted_at: string | null;
}>;

export type CandidateProfileRow = Row<{
  id: string;
  user_id: string;
  full_name: string;
  mobile: string;
  city_id: number | null;
  state: string | null;
  open_to_relocation: number;
  current_job_title: string | null;
  current_employer: string | null;
  years_of_experience: number | null;
  sector_id: number | null;
  sector_other: string | null;
  functional_area_id: number | null;
  education_level: string | null;
  education_level_other: string | null;
  qualification: string | null;
  qualification_year: number | null;
  career_summary: string | null;
  notice_period: string | null;
  employment_preference: string | null;
  /** PRIVATE — admin only. Must never reach an employer view. */
  current_salary: number | null;
  expected_salary_min: number | null;
  expected_salary_max: number | null;
  linkedin_url: string | null;
  resume_file_id: string | null;
  profile_status: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by_id: string | null;
  review_note: string | null;
  completion_percent: number;
  consented_at: string | null;
  consent_version: string | null;
  last_active_at: string | null;
  last_approved_snapshot: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}>;

export type CandidateExperienceRow = Row<{
  id: string;
  candidate_profile_id: string;
  company: string;
  title: string;
  start_year: number;
  end_year: number | null;
  is_current: number;
  domain_tags: string | null;
  key_achievement: string | null;
  sort_order: number;
}>;

export type EmployerProfileRow = Row<{
  id: string;
  user_id: string;
  company_name: string;
  sector_id: number | null;
  locations: string | null;
  website: string | null;
  linkedin_url: string | null;
  hr_contact_name: string;
  hr_contact_email: string;
  hr_contact_phone: string;
  company_intro: string | null;
  account_status: string;
  reviewed_at: string | null;
  reviewed_by_id: string | null;
  review_note: string | null;
  last_approved_snapshot: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}>;

/** Extra hiring locations beyond a job's primary city_id/state. */
export type JobLocationRow = Row<{
  id: string;
  job_id: string;
  city_id: number | null;
  state: string;
  sort_order: number;
  created_at: string;
}>;

export type JobRow = Row<{
  id: string;
  employer_profile_id: string;
  title: string;
  department: string | null;
  number_of_positions: number;
  sector_id: number | null;
  functional_area_id: number | null;
  city_id: number | null;
  state: string | null;
  work_type: string | null;
  min_experience: number | null;
  max_experience: number | null;
  education_requirement: string | null;
  description: string | null;
  target_joining_date: string | null;
  /** CONFIDENTIAL — admin and the owning employer only. */
  salary_band_min: number | null;
  salary_band_max: number | null;
  status: string;
  published_at: string | null;
  closed_at: string | null;
  reviewed_at: string | null;
  reviewed_by_id: string | null;
  review_note: string | null;
  contact_flags: string | null;
  last_approved_snapshot: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}>;

export type JobSkillRow = Row<{
  job_id: string;
  skill_id: number;
  requirement: string;
}>;

export type ApplicationRow = Row<{
  id: string;
  job_id: string;
  candidate_profile_id: string;
  source: string;
  stage: string;
  is_recommended: number;
  recommended_by_id: string | null;
  recommended_at: string | null;
  applied_at: string;
  last_stage_change_at: string;
  first_employer_action_at: string | null;
  employer_last_viewed_at: string | null;
  outcome_reason_code: string | null;
  resume_file_id_at_apply: string | null;
  created_at: string;
  updated_at: string;
}>;

export type ApplicationStageEventRow = Row<{
  id: number;
  application_id: string;
  from_stage: string | null;
  to_stage: string;
  changed_by_id: string | null;
  changed_by_role: string;
  note: string | null;
  created_at: string;
}>;

export type InterviewRow = Row<{
  id: string;
  application_id: string;
  scheduled_at: string;
  duration_minutes: number;
  mode: string;
  location_or_link: string;
  instructions: string | null;
  status: string;
  candidate_confirmed_at: string | null;
  employer_confirmed_at: string | null;
  superseded_by_id: string | null;
  created_by_id: string;
  created_at: string;
  updated_at: string;
}>;

export type InterviewRequestRow = Row<{
  id: string;
  application_id: string;
  requested_by_id: string;
  preferred_slots: string | null;
  note: string | null;
  status: string;
  resolved_at: string | null;
  created_at: string;
}>;

export type AdminNoteRow = Row<{
  id: string;
  author_id: string;
  entity_type: string;
  entity_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}>;

export type NotificationRow = Row<{
  id: string;
  user_id: string;
  event: string;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
}>;

export type ErasureRequestRow = Row<{
  id: string;
  user_id: string;
  reason: string | null;
  status: string;
  decision_note: string | null;
  requested_at: string;
  handled_at: string | null;
  handled_by_id: string | null;
}>;

export type AuditLogRow = Row<{
  id: number;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: string | null;
  ip_address: string | null;
  created_at: string;
}>;

export type ContactEnquiryRow = Row<{
  id: string;
  name: string;
  email: string;
  phone: string | null;
  enquiry_type: string;
  message: string;
  handled_at: string | null;
  handled_by_id: string | null;
  created_at: string;
}>;

// ---------------------------------------------------------------------------
// Schema-parity manifest
//
// Every table in the database must appear here, with its exact column set and
// which columns are NOT NULL. The parity test compares this against
// PRAGMA table_info and fails on any difference in either direction.
// ---------------------------------------------------------------------------

export interface TableSpec {
  /** Column name → true when the column is NOT NULL in the schema. */
  readonly columns: Readonly<Record<string, boolean>>;
}

export const TABLE_COLUMNS: Readonly<Record<string, TableSpec>> = {
  schema_migrations: {
    columns: { id: true, filename: true, applied_at: true },
  },
  review_status: {
    columns: { code: true, label: true, sort_order: true },
  },
  job_status: {
    columns: { code: true, label: true, sort_order: true, is_public: true },
  },
  application_stage: {
    columns: { code: true, label: true, sort_order: true },
  },
  sector: {
    columns: { id: false, slug: true, name: true, sort_order: true, is_active: true },
  },
  functional_area: {
    columns: { id: false, slug: true, name: true, sort_order: true, is_active: true },
  },
  city: {
    columns: { id: false, slug: true, name: true, state: false, sort_order: true, is_active: true },
  },
  skill: {
    columns: { id: false, slug: true, name: true, is_approved: true, created_at: true },
  },
  user: {
    columns: {
      id: true,
      email: true,
      password_hash: true,
      role: true,
      status: true,
      must_change_password: true,
      last_login_at: false,
      created_at: true,
      updated_at: true,
      deleted_at: false,
    },
  },
  session: {
    columns: {
      id: true,
      token_hash: true,
      user_id: true,
      expires_at: true,
      ip_address: false,
      user_agent: false,
      created_at: true,
    },
  },
  file_asset: {
    columns: {
      id: true,
      owner_id: true,
      kind: true,
      original_name: true,
      stored_path: true,
      mime_type: true,
      size_bytes: true,
      checksum: true,
      created_at: true,
      deleted_at: false,
    },
  },
  candidate_profile: {
    columns: {
      id: true,
      user_id: true,
      full_name: true,
      mobile: true,
      city_id: false,
      state: false,
      open_to_relocation: true,
      current_job_title: false,
      current_employer: false,
      years_of_experience: false,
      sector_id: false,
      sector_other: false,
      functional_area_id: false,
      education_level: false,
      education_level_other: false,
      qualification: false,
      qualification_year: false,
      career_summary: false,
      notice_period: false,
      employment_preference: false,
      current_salary: false,
      expected_salary_min: false,
      expected_salary_max: false,
      linkedin_url: false,
      resume_file_id: false,
      profile_status: true,
      submitted_at: false,
      reviewed_at: false,
      reviewed_by_id: false,
      review_note: false,
      completion_percent: true,
      consented_at: false,
      consent_version: false,
      last_active_at: false,
      last_approved_snapshot: false,
      created_at: true,
      updated_at: true,
      deleted_at: false,
    },
  },
  candidate_skill: {
    columns: { candidate_profile_id: true, skill_id: true },
  },
  candidate_experience: {
    columns: {
      id: true,
      candidate_profile_id: true,
      company: true,
      title: true,
      start_year: true,
      end_year: false,
      is_current: true,
      domain_tags: false,
      key_achievement: false,
      sort_order: true,
    },
  },
  job: {
    columns: {
      id: true,
      employer_profile_id: true,
      title: true,
      department: false,
      number_of_positions: true,
      sector_id: false,
      functional_area_id: false,
      city_id: false,
      state: false,
      work_type: false,
      min_experience: false,
      max_experience: false,
      education_requirement: false,
      description: false,
      target_joining_date: false,
      salary_band_min: false,
      salary_band_max: false,
      status: true,
      published_at: false,
      closed_at: false,
      reviewed_at: false,
      reviewed_by_id: false,
      review_note: false,
      contact_flags: false,
      last_approved_snapshot: false,
      created_at: true,
      updated_at: true,
      deleted_at: false,
    },
  },
  job_skill: {
    columns: { job_id: true, skill_id: true, requirement: true },
  },
  job_location: {
    columns: {
      id: true,
      job_id: true,
      city_id: false,
      state: true,
      sort_order: true,
      created_at: true,
    },
  },
  application: {
    columns: {
      id: true,
      job_id: true,
      candidate_profile_id: true,
      source: true,
      stage: true,
      is_recommended: true,
      recommended_by_id: false,
      recommended_at: false,
      applied_at: true,
      last_stage_change_at: true,
      first_employer_action_at: false,
      employer_last_viewed_at: false,
      outcome_reason_code: false,
      resume_file_id_at_apply: false,
      created_at: true,
      updated_at: true,
    },
  },
  application_stage_event: {
    columns: {
      id: false,
      application_id: true,
      from_stage: false,
      to_stage: true,
      changed_by_id: false,
      changed_by_role: true,
      note: false,
      created_at: true,
    },
  },
  interview: {
    columns: {
      id: true,
      application_id: true,
      scheduled_at: true,
      duration_minutes: true,
      mode: true,
      location_or_link: true,
      instructions: false,
      status: true,
      candidate_confirmed_at: false,
      employer_confirmed_at: false,
      superseded_by_id: false,
      created_by_id: true,
      created_at: true,
      updated_at: true,
    },
  },
  interview_request: {
    columns: {
      id: true,
      application_id: true,
      requested_by_id: true,
      preferred_slots: false,
      note: false,
      status: true,
      resolved_at: false,
      created_at: true,
    },
  },
  admin_note: {
    columns: {
      id: true,
      author_id: true,
      entity_type: true,
      entity_id: true,
      body: true,
      created_at: true,
      updated_at: true,
    },
  },
  audit_log: {
    columns: {
      id: false,
      actor_id: false,
      action: true,
      entity_type: true,
      entity_id: true,
      metadata: false,
      ip_address: false,
      created_at: true,
    },
  },
  notification: {
    columns: {
      id: true,
      user_id: true,
      event: true,
      title: true,
      body: false,
      entity_type: false,
      entity_id: false,
      read_at: false,
      created_at: true,
    },
  },
  erasure_request: {
    columns: {
      id: true,
      user_id: true,
      reason: false,
      status: true,
      decision_note: false,
      requested_at: true,
      handled_at: false,
      handled_by_id: false,
    },
  },
  contact_enquiry: {
    columns: {
      id: true,
      name: true,
      email: true,
      phone: false,
      enquiry_type: true,
      message: true,
      handled_at: false,
      handled_by_id: false,
      created_at: true,
    },
  },
  employer_profile: {
    columns: {
      id: true,
      user_id: true,
      company_name: true,
      sector_id: false,
      locations: false,
      website: false,
      linkedin_url: false,
      hr_contact_name: true,
      hr_contact_email: true,
      hr_contact_phone: true,
      company_intro: false,
      account_status: true,
      reviewed_at: false,
      reviewed_by_id: false,
      review_note: false,
      last_approved_snapshot: false,
      created_at: true,
      updated_at: true,
      deleted_at: false,
    },
  },
};
