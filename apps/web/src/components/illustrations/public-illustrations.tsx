/**
 * Custom vector illustrations for the public site — the shared badge motif,
 * the hero orbit backdrop, the recruitment dashboard scene, the layered
 * profile-cards motif, and the illustration placeholder slot. Plain inline
 * SVG built from primitives — no stock art, no embedded reference image.
 *
 * The "Who We Serve" character illustrations are the client-supplied PNGs in
 * src/assets/illustrations/, not SVG — see pages/public/home.tsx.
 */

import type { ReactNode } from 'react';

/* ---------------------------------------------------------------------- */
/* Illustration placeholder — a clean, clearly-a-slot frame for a "people/  */
/* team" photo that hasn't been supplied yet. Deliberately not a crude SVG  */
/* character: swap the <img> in where this is used once a transparent PNG  */
/* lands in src/assets/illustrations/, no layout change needed.            */
/* ---------------------------------------------------------------------- */

const PLACEHOLDER_TONE = {
  light: {
    frame: 'border-pub-border bg-pub-blue-light/40',
    blobA: 'bg-pub-blue/10',
    blobB: 'bg-pub-navy/10',
    badge: 'bg-white text-pub-blue',
    caption: 'text-pub-muted',
  },
  dark: {
    frame: 'border-white/25 bg-white/5',
    blobA: 'bg-white/10',
    blobB: 'bg-white/10',
    badge: 'bg-white/15 text-white',
    caption: 'text-white/70',
  },
} as const;

export function IllustrationPlaceholder({
  caption,
  tone = 'light',
  className = '',
}: {
  caption: string;
  tone?: keyof typeof PLACEHOLDER_TONE;
  className?: string;
}) {
  const t = PLACEHOLDER_TONE[tone];
  return (
    <div className={`relative flex flex-col items-center justify-center gap-3 overflow-hidden rounded-3xl border-2 border-dashed ${t.frame} ${className}`}>
      <div aria-hidden="true" className={`absolute -left-8 -top-8 h-32 w-32 rounded-full ${t.blobA}`} />
      <div aria-hidden="true" className={`absolute -bottom-10 -right-6 h-40 w-40 rounded-full ${t.blobB}`} />
      <span className={`relative flex size-14 items-center justify-center rounded-full shadow-sm ${t.badge}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="size-6">
          <rect x="3" y="4.5" width="18" height="15" rx="2" />
          <circle cx="8.5" cy="9.5" r="1.75" />
          <path d="m4 17 5-5 3.5 3.5L16.5 11 20 15" />
        </svg>
      </span>
      <span className={`relative text-xs font-medium ${t.caption}`}>{caption}</span>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Shared badge — the one recurring "node" motif (hero orbit, Why Us,      */
/* How It Works) so the illustration system reads as one language.         */
/* ---------------------------------------------------------------------- */

const BADGE_SIZE = {
  md: 'size-12',
  lg: 'size-14',
  xl: 'size-16',
} as const;

export function IllustratedBadge({
  children,
  size = 'md',
  className = '',
}: {
  children: ReactNode;
  size?: keyof typeof BADGE_SIZE;
  className?: string;
}) {
  return (
    <span
      className={`flex ${BADGE_SIZE[size]} shrink-0 items-center justify-center rounded-full text-white shadow-lg shadow-pub-navy/25 ring-4 ring-white ${className}`}
      style={{ background: 'radial-gradient(circle at 30% 25%, var(--color-pub-blue), var(--color-pub-navy) 78%)' }}
    >
      {children}
    </span>
  );
}

/* ---------------------------------------------------------------------- */
/* Hero orbit backdrop — glow + concentric arcs + a radial sunburst of      */
/* spokes. Purely decorative; the actual node labels are HTML, laid on top */
/* by the caller so they stay accessible text rather than SVG glyphs.      */
/* ---------------------------------------------------------------------- */

export function HeroOrbitBackdrop({ className = '' }: { className?: string }) {
  const center = { x: 450, y: 430 };
  const spokeAngles = [200, 215, 230, 250, 270, 290, 310, 325, 340];

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 900 440"
      preserveAspectRatio="xMidYMax meet"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    >
      <defs>
        <radialGradient id="pubHeroGlow" cx="50%" cy="100%" r="75%">
          <stop offset="0%" stopColor="var(--color-pub-blue-light)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="var(--color-pub-blue-light)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx={center.x} cy={center.y} r="380" fill="url(#pubHeroGlow)" />

      {spokeAngles.map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const outer = { x: center.x + 380 * Math.cos(rad), y: center.y + 380 * Math.sin(rad) };
        const inner = { x: center.x + 150 * Math.cos(rad), y: center.y + 150 * Math.sin(rad) };
        return (
          <line
            key={deg}
            x1={inner.x}
            y1={inner.y}
            x2={outer.x}
            y2={outer.y}
            stroke="var(--color-pub-border)"
            strokeWidth="1"
          />
        );
      })}

      {[222, 312, 398].map((r) => (
        <circle
          key={r}
          cx={center.x}
          cy={center.y}
          r={r}
          fill="none"
          stroke="var(--color-pub-blue)"
          strokeOpacity="0.38"
          strokeWidth="1.5"
          strokeDasharray="1 8"
        />
      ))}
    </svg>
  );
}

/* ---------------------------------------------------------------------- */
/* Recruitment dashboard illustration — layered cards for the Approach     */
/* section: a mini activity chart, three profile rows, floating accents.   */
/* ---------------------------------------------------------------------- */

const STAGE_FILL: Record<'green' | 'amber' | 'slate', string> = {
  green: '#a7f3d0',
  amber: '#fde68a',
  slate: 'var(--color-pub-blue-light)',
};

export function RecruitmentDashboardArt({
  rows,
  className = '',
}: {
  rows: readonly { name: string; stage: string; tone: 'green' | 'amber' | 'slate' }[];
  className?: string;
}) {
  return (
    <svg viewBox="0 0 380 300" className={className} role="img" aria-label="Recruitment dashboard showing applicant pipeline stages">
      <circle cx="40" cy="30" r="46" fill="var(--color-pub-blue)" opacity="0.08" />
      <circle cx="352" cy="270" r="56" fill="var(--color-pub-navy)" opacity="0.08" />

      {/* back card, offset for depth */}
      <rect x="46" y="26" width="288" height="228" rx="20" fill="var(--color-pub-blue-light)" transform="rotate(-3 190 140)" />

      {/* main card */}
      <rect x="30" y="18" width="288" height="234" rx="18" fill="white" stroke="var(--color-pub-border)" />

      {/* header */}
      <circle cx="56" cy="46" r="12" fill="var(--color-pub-blue-light)" />
      <path d="M50 46 h12 M50 50 h8" stroke="var(--color-pub-blue)" strokeWidth="2" strokeLinecap="round" />
      <rect x="76" y="41" width="90" height="6" rx="3" fill="var(--color-pub-navy)" opacity="0.7" />

      {/* mini activity chart */}
      {[18, 30, 22, 38, 26].map((h, i) => (
        <rect
          key={i}
          x={230 + i * 15}
          y={70 - h}
          width="9"
          height={h}
          rx="2"
          fill={i === 3 ? 'var(--color-pub-navy)' : 'var(--color-pub-blue)'}
        />
      ))}

      {/* candidate rows, one per pipeline stage supplied by the caller */}
      {rows.map((row, i) => {
        const y = 92 + i * 56;
        return (
          <g key={row.name + i}>
            <rect x="50" y={y} width="248" height="46" rx="12" fill="white" stroke="var(--color-pub-border)" />
            <circle cx="76" cy={y + 23} r="14" fill="var(--color-pub-blue-light)" />
            <path
              d={`M${76 - 6} ${y + 20} a6 6 0 0 1 12 0 M${76 - 8} ${y + 30} a8 8 0 0 1 16 0`}
              stroke="var(--color-pub-blue)"
              strokeWidth="1.6"
              fill="none"
              strokeLinecap="round"
            />
            <rect x="100" y={y + 12} width="70" height="6" rx="3" fill="var(--color-pub-navy)" opacity="0.65" />
            <rect x="100" y={y + 24} width="34" height="10" rx="5" fill="var(--color-pub-blue-light)" />
            <rect x="138" y={y + 24} width="34" height="10" rx="5" fill="var(--color-pub-blue-light)" />
            <rect x="240" y={y + 15} width="46" height="16" rx="8" fill={STAGE_FILL[row.tone]} />
          </g>
        );
      })}

      {/* floating leaf accent */}
      <g transform="translate(346 40)">
        <ellipse cx="0" cy="0" rx="7" ry="16" fill="var(--color-pub-blue)" transform="rotate(20 0 0)" />
        <ellipse cx="6" cy="4" rx="5" ry="12" fill="var(--color-pub-blue-light)" transform="rotate(-25 6 4)" />
      </g>
    </svg>
  );
}

/* ---------------------------------------------------------------------- */
/* Layered profile cards — two overlapping profile-card mockups with a     */
/* big "verified" check badge, used behind the benefits/CTA copy blocks.   */
/* ---------------------------------------------------------------------- */

export function LayeredProfileCardsArt({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 360 320" className={className} role="img" aria-label="Two profile cards, one marked verified">
      <path
        d="M40 250 C10 210 10 120 60 80 C120 30 220 20 270 60 C320 100 330 200 280 250 C230 300 90 300 40 250 Z"
        fill="var(--color-pub-navy)"
      />
      <g aria-hidden="true">
        {[0, 1, 2].map((row) =>
          [0, 1, 2].map((col) => (
            <circle
              key={`${row}-${col}`}
              cx={26 + col * 13}
              cy={252 + row * 13}
              r="2.5"
              fill="var(--color-pub-blue-light)"
              opacity="0.7"
            />
          )),
        )}
      </g>

      {/* back card */}
      <g transform="rotate(-8 150 150)">
        <rect x="60" y="90" width="180" height="130" rx="16" fill="white" stroke="var(--color-pub-border)" />
        <circle cx="88" cy="118" r="12" fill="var(--color-pub-blue-light)" />
        <rect x="108" y="112" width="70" height="6" rx="3" fill="var(--color-pub-border)" />
        <rect x="108" y="122" width="50" height="6" rx="3" fill="var(--color-pub-blue-light)" />
        <rect x="76" y="150" width="148" height="6" rx="3" fill="var(--color-pub-border)" />
        <rect x="76" y="164" width="120" height="6" rx="3" fill="var(--color-pub-border)" />
        <rect x="76" y="178" width="100" height="6" rx="3" fill="var(--color-pub-blue-light)" />
      </g>

      {/* front card */}
      <g transform="rotate(5 200 190)">
        <rect x="110" y="140" width="180" height="130" rx="16" fill="white" stroke="var(--color-pub-border)" />
        <circle cx="138" cy="168" r="12" fill="var(--color-pub-blue-light)" />
        <rect x="158" y="162" width="70" height="6" rx="3" fill="var(--color-pub-border)" />
        <rect x="158" y="172" width="50" height="6" rx="3" fill="var(--color-pub-blue-light)" />
        <rect x="126" y="200" width="148" height="6" rx="3" fill="var(--color-pub-border)" />
        <rect x="126" y="214" width="120" height="6" rx="3" fill="var(--color-pub-border)" />
        <rect x="126" y="228" width="100" height="6" rx="3" fill="var(--color-pub-blue-light)" />
      </g>

      {/* verified badge */}
      <g transform="translate(232 118)">
        <circle r="30" fill="var(--color-pub-blue)" stroke="white" strokeWidth="5" />
        <path d="m-13 1 9 9 20 -20" stroke="white" strokeWidth="5.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/* ---------------------------------------------------------------------- */
/* Small shared "person" glyph — a head + shoulders, used at avatar scale   */
/* wherever a row needs to represent a candidate without a full figure.    */
/* ---------------------------------------------------------------------- */

function AvatarGlyph({ cx, cy, r = 8 }: { cx: number; cy: number; r?: number }) {
  return (
    <path
      d={`M${cx - r * 0.55} ${cy - r * 0.15} a${r * 0.55} ${r * 0.55} 0 0 1 ${r * 1.1} 0 M${cx - r * 0.75} ${cy + r * 0.7} a${r * 0.75} ${r * 0.75} 0 0 1 ${r * 1.5} 0`}
      stroke="var(--color-pub-blue)"
      strokeWidth={Math.max(1.4, r * 0.14)}
      fill="none"
      strokeLinecap="round"
    />
  );
}

/* ---------------------------------------------------------------------- */
/* Verified Talent — single profile card with a shield-check badge,        */
/* the compact companion to LayeredProfileCardsArt for a 3-up row.         */
/* ---------------------------------------------------------------------- */

export function VerifiedTalentArt({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 180 150" className={className} role="img" aria-label="A verified candidate profile card">
      <circle cx="150" cy="24" r="26" fill="var(--color-pub-blue-light)" opacity="0.6" />
      <circle cx="18" cy="128" r="18" fill="var(--color-pub-blue-light)" opacity="0.6" />

      <rect x="20" y="20" width="120" height="110" rx="16" fill="white" stroke="var(--color-pub-border)" />
      <circle cx="52" cy="52" r="14" fill="var(--color-pub-blue-light)" />
      <AvatarGlyph cx={52} cy={52} r={9} />
      <rect x="74" y="45" width="52" height="6" rx="3" fill="var(--color-pub-border)" />
      <rect x="74" y="57" width="36" height="6" rx="3" fill="var(--color-pub-blue-light)" />
      <rect x="36" y="86" width="88" height="6" rx="3" fill="var(--color-pub-border)" />
      <rect x="36" y="100" width="66" height="6" rx="3" fill="var(--color-pub-border)" />
      <rect x="36" y="114" width="50" height="6" rx="3" fill="var(--color-pub-blue-light)" />

      <g transform="translate(134 26)">
        <circle r="20" fill="var(--color-pub-blue)" stroke="white" strokeWidth="4" />
        <path d="m-8 1 5.5 5.5 11 -12" stroke="white" strokeWidth="3.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/* ---------------------------------------------------------------------- */
/* Expert Screening — a clipboard of checks with a magnifying glass.       */
/* ---------------------------------------------------------------------- */

export function ScreeningArt({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 180 150" className={className} role="img" aria-label="A clipboard of screened candidates">
      <circle cx="140" cy="30" r="24" fill="var(--color-pub-blue-light)" opacity="0.6" />

      <rect x="34" y="18" width="92" height="112" rx="12" fill="white" stroke="var(--color-pub-border)" />
      <rect x="60" y="12" width="40" height="16" rx="4" fill="var(--color-pub-navy)" />

      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(48 ${52 + i * 24})`}>
          <circle r="7" fill="var(--color-pub-blue-light)" />
          <path d="m-3 0 2 2 4.5 -4.5" stroke="var(--color-pub-blue)" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="14" y="-3" width="46" height="6" rx="3" fill="var(--color-pub-border)" />
        </g>
      ))}

      <g transform="translate(128 108)">
        <circle r="20" fill="white" stroke="var(--color-pub-navy)" strokeWidth="6" />
        <line x1="14" y1="14" x2="26" y2="26" stroke="var(--color-pub-navy)" strokeWidth="7" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/* ---------------------------------------------------------------------- */
/* Faster Hiring — an ascending bar chart with a trend arrow.               */
/* ---------------------------------------------------------------------- */

export function GrowthChartArt({ className = '' }: { className?: string }) {
  const bars = [30, 46, 40, 62, 78];
  return (
    <svg viewBox="0 0 180 150" className={className} role="img" aria-label="An upward hiring trend chart">
      <circle cx="34" cy="34" r="22" fill="var(--color-pub-blue-light)" opacity="0.6" />
      <rect x="24" y="24" width="132" height="102" rx="14" fill="white" stroke="var(--color-pub-border)" />

      {bars.map((h, i) => (
        <rect
          key={i}
          x={40 + i * 22}
          y={112 - h}
          width="14"
          height={h}
          rx="3"
          fill={i === bars.length - 1 ? 'var(--color-pub-navy)' : 'var(--color-pub-blue)'}
        />
      ))}

      <path
        d="M38 92 L82 66 L104 78 L146 40"
        stroke="var(--color-pub-navy)"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M146 40 l-11 1 3 11 Z" fill="var(--color-pub-navy)" />
    </svg>
  );
}

/* ---------------------------------------------------------------------- */
/* Employer dashboard — a pipeline snapshot for the "What You Can Do"       */
/* section: stage counts, applicant rows (no scores — employers never see  */
/* a ranking, only application order) and a skills-mix side panel.         */
/* ---------------------------------------------------------------------- */

export function EmployerDashboardArt({
  counts,
  rows,
  className = '',
}: {
  counts: readonly { label: string; value: string }[];
  rows: readonly { stage: string; tone: 'green' | 'amber' | 'slate' }[];
  className?: string;
}) {
  const stageFill: Record<'green' | 'amber' | 'slate', string> = {
    green: '#a7f3d0',
    amber: '#fde68a',
    slate: 'var(--color-pub-blue-light)',
  };
  const skillBars = [70, 45, 55, 30];

  return (
    <svg viewBox="0 0 420 320" className={className} role="img" aria-label="Employer dashboard showing applicant pipeline">
      <circle cx="380" cy="30" r="50" fill="var(--color-pub-blue)" opacity="0.08" />
      <circle cx="24" cy="290" r="46" fill="var(--color-pub-navy)" opacity="0.08" />

      {/* back card */}
      <rect x="20" y="24" width="330" height="252" rx="20" fill="var(--color-pub-blue-light)" transform="rotate(2 185 150)" />

      {/* main card */}
      <rect x="8" y="16" width="330" height="258" rx="18" fill="white" stroke="var(--color-pub-border)" />

      {/* window chrome dots */}
      <circle cx="26" cy="34" r="3" fill="var(--color-pub-border)" />
      <circle cx="36" cy="34" r="3" fill="var(--color-pub-border)" />
      <circle cx="46" cy="34" r="3" fill="var(--color-pub-border)" />

      {/* stage counts */}
      {counts.map((c, i) => (
        <g key={c.label} transform={`translate(${26 + i * 80} 50)`}>
          <rect width="70" height="46" rx="10" fill="var(--color-pub-bg)" />
          <text x="12" y="20" fontSize="16" fontWeight="700" fill="var(--color-pub-navy)" fontFamily="var(--font-heading)">
            {c.value}
          </text>
          <text x="12" y="35" fontSize="8" fill="var(--color-pub-muted)" fontFamily="var(--font-public)">
            {c.label}
          </text>
        </g>
      ))}

      {/* applicant rows */}
      {rows.map((row, i) => {
        const y = 112 + i * 42;
        return (
          <g key={i}>
            <rect x="26" y={y} width="286" height="34" rx="10" fill="white" stroke="var(--color-pub-border)" />
            <circle cx="46" cy={y + 17} r="11" fill="var(--color-pub-blue-light)" />
            <AvatarGlyph cx={46} cy={y + 17} r={7} />
            <rect x="64" y={y + 10} width="60" height="5" rx="2.5" fill="var(--color-pub-navy)" opacity="0.6" />
            <rect x="64" y={y + 20} width="40" height="5" rx="2.5" fill="var(--color-pub-blue-light)" />
            <rect x="256" y={y + 9} width="46" height="16" rx="8" fill={stageFill[row.tone]} />
          </g>
        );
      })}

      {/* floating skills-mix card */}
      <g transform="translate(300 190)">
        <rect width="110" height="100" rx="14" fill="white" stroke="var(--color-pub-border)" />
        <rect x="12" y="12" width="60" height="6" rx="3" fill="var(--color-pub-navy)" opacity="0.6" />
        {skillBars.map((w, i) => (
          <g key={i} transform={`translate(12 ${30 + i * 16})`}>
            <rect width="86" height="7" rx="3.5" fill="var(--color-pub-bg)" />
            <rect width={0.86 * w} height="7" rx="3.5" fill="var(--color-pub-blue)" />
          </g>
        ))}
      </g>
    </svg>
  );
}

/* ---------------------------------------------------------------------- */
/* Target + avatars — a bullseye with two candidate glyphs, for a closing  */
/* "find the right fit" CTA moment.                                        */
/* ---------------------------------------------------------------------- */

export function TargetAvatarsArt({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 200" className={className} role="img" aria-label="A target with two candidate profiles nearby">
      <circle cx="110" cy="100" r="70" fill="var(--color-pub-blue-light)" />
      <circle cx="110" cy="100" r="52" fill="none" stroke="var(--color-pub-blue)" strokeWidth="10" opacity="0.55" />
      <circle cx="110" cy="100" r="32" fill="none" stroke="var(--color-pub-blue)" strokeWidth="10" opacity="0.8" />
      <circle cx="110" cy="100" r="12" fill="var(--color-pub-navy)" />

      <g transform="translate(28 34)">
        <circle r="22" fill="white" stroke="var(--color-pub-border)" strokeWidth="2" />
        <AvatarGlyph cx={0} cy={0} r={13} />
      </g>
      <g transform="translate(190 150)">
        <circle r="22" fill="white" stroke="var(--color-pub-border)" strokeWidth="2" />
        <AvatarGlyph cx={0} cy={0} r={13} />
      </g>
    </svg>
  );
}

/* ---------------------------------------------------------------------- */
/* Contact — a chat bubble with a message line and a "sent" check badge,   */
/* the Contact page's companion to VerifiedTalentArt's card-plus-badge     */
/* composition.                                                            */
/* ---------------------------------------------------------------------- */

export function ContactChatArt({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 260" className={className} role="img" aria-label="A message bubble being sent, with a confirmation check">
      <circle cx="252" cy="46" r="34" fill="var(--color-pub-blue-light)" opacity="0.7" />
      <circle cx="34" cy="214" r="26" fill="var(--color-pub-blue-light)" opacity="0.7" />

      <rect x="40" y="30" width="220" height="150" rx="20" fill="white" stroke="var(--color-pub-border)" />
      <g transform="translate(70 60)">
        <circle r="16" fill="var(--color-pub-blue-light)" />
        <AvatarGlyph cx={0} cy={0} r={10} />
      </g>
      <rect x="100" y="52" width="120" height="8" rx="4" fill="var(--color-pub-navy)" opacity="0.7" />
      <rect x="100" y="68" width="80" height="8" rx="4" fill="var(--color-pub-blue-light)" />

      <rect x="70" y="98" width="160" height="10" rx="5" fill="var(--color-pub-border)" />
      <rect x="70" y="116" width="140" height="10" rx="5" fill="var(--color-pub-border)" />
      <rect x="70" y="134" width="100" height="10" rx="5" fill="var(--color-pub-blue-light)" />

      {/* bubble tail */}
      <path d="M78 180 L78 202 L104 180 Z" fill="white" stroke="var(--color-pub-border)" strokeLinejoin="round" />

      <g transform="translate(246 168)">
        <circle r="28" fill="var(--color-pub-blue)" stroke="white" strokeWidth="5" />
        <path d="m-11 1 7 7 15 -16" stroke="white" strokeWidth="4.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
