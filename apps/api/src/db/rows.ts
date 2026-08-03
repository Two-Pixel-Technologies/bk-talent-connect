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

export type ReviewStatusRow = Row<{
  code: string;
  label: string;
  sort_order: number;
}>;

export type JobStatusRow = Row<{
  code: string;
  label: string;
  sort_order: number;
  is_public: number;
}>;

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
  functional_area_id: number | null;
  education_level: string | null;
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
    columns: { id: false, slug: true, name: true, sort_order: true, is_active: true },
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
      functional_area_id: false,
      education_level: false,
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
