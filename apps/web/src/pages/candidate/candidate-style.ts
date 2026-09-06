/**
 * Visual-only constants shared across Candidate Portal pages.
 *
 * Kept candidate-scoped and separate from components/ui/index.tsx on
 * purpose: Card/Button/Badge there are shared with Employer and Admin, and
 * this stronger surface treatment is specifically what candidates asked
 * for — sections that read as clearly separated cards rather than blending
 * into the page background. Importing this into an Employer or Admin page
 * would be a scope mistake, not a shortcut.
 */
export const CANDIDATE_CARD = 'border-slate-300/70 shadow-[0_2px_10px_rgba(15,23,42,0.05)]';
