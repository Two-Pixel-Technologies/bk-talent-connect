/**
 * Visual-only constant shared across Admin Portal pages.
 *
 * Mirrors pages/candidate/candidate-style.ts and pages/employer/employer-style.ts
 * exactly, for the same reason: a slightly stronger border/shadow than the
 * shared Card default, scoped to this portal only via extra className (never
 * edited into the shared component), so Candidate/Employer surfaces stay
 * untouched.
 */
export const ADMIN_CARD = 'border-slate-300/70 shadow-[0_2px_10px_rgba(15,23,42,0.05)]';
