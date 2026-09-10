/**
 * Visual-only constant shared across Employer Portal pages.
 *
 * Mirrors pages/candidate/candidate-style.ts exactly, for the same reason:
 * a slightly stronger border/shadow than the shared Card default, scoped to
 * this portal only via extra className (never edited into the shared
 * component), so Candidate/Admin surfaces stay untouched.
 */
export const EMPLOYER_CARD = 'border-slate-300/70 shadow-[0_2px_10px_rgba(15,23,42,0.05)]';
