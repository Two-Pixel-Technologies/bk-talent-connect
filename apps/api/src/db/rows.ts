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
};
