/**
 * CANDIDATE PORTAL PROTOTYPE — small vector-led illustrations.
 * Same hand-drawn stroke language as components/icons/public-icons.tsx,
 * scaled up for use as light supporting visuals (never full-page hero art)
 * on profile/jobs/applications/interview/empty states. Reusable, editable
 * inline SVG — no external assets.
 */

type ArtProps = { className?: string };

/** Verified profile — a badge over a simple id-card shape. */
export function ProfileVerifiedArt({ className = '' }: ArtProps) {
  return (
    <svg viewBox="0 0 120 100" className={className} role="img" aria-label="A verified candidate profile">
      <rect x="8" y="10" width="72" height="80" rx="12" fill="var(--color-pub-blue-light)" />
      <circle cx="44" cy="42" r="12" fill="white" stroke="var(--color-pub-blue)" strokeWidth="2" />
      <path d="M39 42l3.5 3.5L50 38" stroke="var(--color-pub-blue)" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="24" y="62" width="40" height="5" rx="2.5" fill="white" />
      <rect x="24" y="72" width="28" height="5" rx="2.5" fill="white" opacity="0.7" />
      <g transform="translate(84 58)">
        <circle r="18" fill="var(--color-pub-navy)" stroke="white" strokeWidth="4" />
        <path d="m-7 0 4.5 4.5 9-9.5" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/** Job discovery — a magnifier over stacked role cards. */
export function JobSearchArt({ className = '' }: ArtProps) {
  return (
    <svg viewBox="0 0 120 100" className={className} role="img" aria-label="Searching for roles">
      <rect x="10" y="14" width="70" height="26" rx="8" fill="var(--color-pub-blue-light)" />
      <rect x="18" y="46" width="70" height="26" rx="8" fill="var(--color-pub-border)" opacity="0.6" />
      <g transform="translate(84 30)">
        <circle r="16" fill="none" stroke="var(--color-pub-navy)" strokeWidth="5" />
        <line x1="11.5" y1="11.5" x2="22" y2="22" stroke="var(--color-pub-navy)" strokeWidth="6" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/** Interview — a calendar with a clock accent. */
export function InterviewArt({ className = '' }: ArtProps) {
  return (
    <svg viewBox="0 0 120 100" className={className} role="img" aria-label="An interview scheduled">
      <rect x="14" y="16" width="72" height="66" rx="10" fill="white" stroke="var(--color-pub-border)" strokeWidth="2" />
      <rect x="14" y="16" width="72" height="18" rx="10" fill="var(--color-pub-navy)" />
      <circle cx="30" cy="25" r="2.4" fill="white" />
      <circle cx="70" cy="25" r="2.4" fill="white" />
      <rect x="26" y="46" width="16" height="12" rx="3" fill="var(--color-pub-blue-light)" />
      <rect x="48" y="46" width="16" height="12" rx="3" fill="var(--color-pub-blue)" />
      <rect x="26" y="64" width="16" height="12" rx="3" fill="var(--color-pub-border)" />
      <g transform="translate(90 68)">
        <circle r="16" fill="white" stroke="var(--color-pub-blue)" strokeWidth="3" />
        <path d="M0 -8v8l6 4" stroke="var(--color-pub-blue)" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/** Success / submitted confirmation. */
export function SuccessCheckArt({ className = '' }: ArtProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label="Success">
      <circle cx="50" cy="50" r="38" fill="var(--color-pub-blue-light)" />
      <circle cx="50" cy="50" r="24" fill="var(--color-pub-blue)" />
      <path d="M40 50l7 7 14-15" stroke="white" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Empty inbox / no results. */
export function EmptyBoxArt({ className = '' }: ArtProps) {
  return (
    <svg viewBox="0 0 100 80" className={className} role="img" aria-label="Nothing here yet">
      <path d="M10 34 L28 12 H72 L90 34" fill="none" stroke="var(--color-pub-border)" strokeWidth="3" strokeLinejoin="round" />
      <rect x="10" y="34" width="80" height="34" rx="6" fill="var(--color-pub-blue-light)" stroke="var(--color-pub-border)" strokeWidth="2" />
      <path d="M10 34h24a6 6 0 0 0 12 6h8a6 6 0 0 0 12-6h24" fill="none" stroke="var(--color-pub-border)" strokeWidth="3" />
    </svg>
  );
}
