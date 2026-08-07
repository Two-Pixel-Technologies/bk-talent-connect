/**
 * Employer serializers.
 *
 * The candidate-facing view exists because the proposal asks employers for a
 * company introduction "shown to candidates on the company profile page". It
 * carries company identity and nothing else — specifically NOT the HR contact
 * name, email or phone, since routing all contact through the admin team is the
 * portal's central rule and a company page would otherwise quietly bypass it.
 */

import type { Row, EmployerProfileRow } from '../db/rows.js';
import { unbrand } from '../db/rows.js';

export type EmployerRelations = {
  readonly sectorSlug: string | null;
  readonly sectorName: string | null;
  readonly locations: readonly string[];
};

function parseLocations(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function locationsOf(row: Row<EmployerProfileRow>): string[] {
  return parseLocations(unbrand(row).locations);
}

/** The employer's own account. */
export function toSelfView(row: Row<EmployerProfileRow>, rel: EmployerRelations) {
  const e = unbrand(row);
  return {
    id: e.id,
    companyName: e.company_name,
    sectorSlug: rel.sectorSlug,
    sectorName: rel.sectorName,
    locations: rel.locations,
    website: e.website,
    linkedinUrl: e.linkedin_url,
    hrContactName: e.hr_contact_name,
    hrContactEmail: e.hr_contact_email,
    hrContactPhone: e.hr_contact_phone,
    companyIntro: e.company_intro,
    accountStatus: e.account_status,
    reviewNote: e.review_note,
    reviewedAt: e.reviewed_at,
    createdAt: e.created_at,
  };
}

/**
 * What a candidate may see about a company. No HR contact details of any kind.
 */
export function toCandidateView(row: Row<EmployerProfileRow>, rel: EmployerRelations) {
  const e = unbrand(row);
  return {
    id: e.id,
    companyName: e.company_name,
    sectorName: rel.sectorName,
    locations: rel.locations,
    website: e.website,
    linkedinUrl: e.linkedin_url,
    companyIntro: e.company_intro,
  };
}

export function toAdminView(
  row: Row<EmployerProfileRow>,
  rel: EmployerRelations,
  extra: { readonly email: string; readonly userStatus: string; readonly jobCount: number },
) {
  return {
    ...toSelfView(row, rel),
    email: extra.email,
    userStatus: extra.userStatus,
    // Same reason as the candidate view: suspension is actioned from here.
    userId: unbrand(row).user_id,
    jobCount: extra.jobCount,
  };
}
