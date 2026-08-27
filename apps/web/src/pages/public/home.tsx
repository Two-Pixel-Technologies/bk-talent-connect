/**
 * Public Home page (P9).
 *
 * Replaces the placeholder landing page. Marketing content only — no data
 * fetching, no backend changes. Every CTA routes into flows that already
 * exist (registration, login); nothing here is gated behind auth.
 *
 * Visuals are custom SVG/CSS illustrations (see components/illustrations),
 * not an embedded image — the page stays a real, responsive React page.
 */

import type { ComponentType } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth, HOME_FOR_ROLE } from '../../features/auth/auth-context.js';
import { PUBLIC_ICONS, type PublicIconKey } from '../../components/icons/public-icons.js';
import { IllustratedBadge, HeroOrbitBackdrop, RecruitmentDashboardArt, HERO_ORBIT } from '../../components/illustrations/public-illustrations.js';
import { home } from '../../content/site.js';
import candidateIllustrationSrc from '../../assets/illustrations/candidate-illustration-transparent.png';
import employerIllustrationSrc from '../../assets/illustrations/employer-illustration-transparent.png';

type IconComp = ComponentType<{ className: string }>;

function Icon({ name, className }: { name: PublicIconKey; className: string }) {
  const Cmp = PUBLIC_ICONS[name] as IconComp;
  return <Cmp className={className} />;
}

export function HomePage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-pub-muted">Loading…</div>;
  }

  // Already signed in — send straight to the portal, not the marketing page.
  if (user) return <Navigate to={HOME_FOR_ROLE[user.role]} replace />;

  return (
    <main className="public-site overflow-x-clip">
      <Hero />
      <Stats />
      <Audiences />
      <HowItWorks />
      <WhyUs />
      <Industries />
      <Approach />
      <ContactBand />
    </main>
  );
}

function SectionHeading({ eyebrow }: { eyebrow: string }) {
  return (
    <p className="text-center text-xs font-semibold uppercase tracking-widest text-pub-blue">{eyebrow}</p>
  );
}

/* ---------------------------------------------------------------------- */
/* Hero                                                                    */
/* ---------------------------------------------------------------------- */

/**
 * Node order matches the arc position it is placed at, top → clockwise.
 * Positions are computed from the exact same center/radius as the SVG
 * rings (HERO_ORBIT, in public-illustrations.tsx) so every icon lands
 * precisely on the outer ring instead of floating near it.
 */
const ORBIT_ANGLES_DEG = [90, 140, 40, 165, 15];
const ORBIT_DOT_ANGLES_DEG = [27.5, 65, 115, 152.5];

function orbitPosition(deg: number) {
  const rad = (deg * Math.PI) / 180;
  const { cx, cy, outerR } = HERO_ORBIT;
  // The 200×100 viewBox maps to the container at aspect-[2/1]: 200 units
  // span 100% of the width (divide by 2), 100 units span 100% of the
  // height (1:1) — see HERO_ORBIT's doc comment in public-illustrations.tsx.
  return {
    left: `${(cx + outerR * Math.cos(rad)) / 2}%`,
    top: `${cy - outerR * Math.sin(rad)}%`,
  };
}

const ORBIT_NODE_POSITIONS = ORBIT_ANGLES_DEG.map(orbitPosition);
const ORBIT_DOT_POSITIONS = ORBIT_DOT_ANGLES_DEG.map(orbitPosition);

function HeroFeatureGlyph({ feature, className }: { feature: number; className: string }) {
  if (feature === 2) return <Icon name="briefcase" className={className} />;
  if (feature === 3) return <Icon name="shieldCheck" className={className} />;

  if (feature === 0) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="12" cy="8" r="3" />
        <path d="M6.8 18.5c.6-3 2.4-4.6 5.2-4.6s4.6 1.6 5.2 4.6" />
        <path d="m16.8 10.8 1.4 1.4 2.7-3" />
        <rect x="4" y="3" width="16" height="18" rx="3" />
      </svg>
    );
  }

  if (feature === 1) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="8" cy="8" r="2.4" />
        <circle cx="16" cy="8" r="2.4" />
        <path d="M3.8 17c.4-2.7 1.8-4.2 4.2-4.2s3.8 1.5 4.2 4.2M11.8 17c.4-2.7 1.8-4.2 4.2-4.2s3.8 1.5 4.2 4.2" />
        <path d="m9.8 19 1.5 1.5 3.2-3.5" />
      </svg>
    );
  }

  if (feature === 4) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M4 13v-2a8 8 0 0 1 16 0v2" />
        <path d="M4 13.5a2.5 2.5 0 0 1 2.5-2.5H8v7H6.5A2.5 2.5 0 0 1 4 15.5v-2Z" />
        <path d="M20 13.5a2.5 2.5 0 0 0-2.5-2.5H16v7h1.5a2.5 2.5 0 0 0 2.5-2.5v-2Z" />
        <path d="M16 18c-.8 1.3-2 2-3.7 2H11" />
        <circle cx="10" cy="20" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m3.5 12 3.2-3.2 4.1 1.4 2.4-1.2 2.6 1.7" />
      <path d="m20.5 12-3.2-3.2-3.5 1.8-2.1 2.1a1.8 1.8 0 0 0 2.5 2.5l1.4-1.3" />
      <path d="m6.3 12.5 5.4 5.3a2 2 0 0 0 2.8 0l4.1-4" />
      <path d="m8.5 15 1.4-1.4m1.1 3.2 1.4-1.4" />
    </svg>
  );
}

/** Home-hero exception: these five orbit nodes intentionally keep the
 * reference's filled blue treatment. Shared public icon badges remain light. */
function HeroNodeBadge({ feature, compact = false }: { feature: number; compact?: boolean }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full border border-white/70 text-white shadow-[0_8px_20px_rgba(23,58,112,0.2)] ${
        compact ? 'size-12' : 'size-[60px]'
      }`}
      style={{ background: 'radial-gradient(circle at 32% 25%, var(--color-pub-blue), var(--color-pub-navy) 82%)' }}
    >
      <HeroFeatureGlyph feature={feature} className={compact ? 'size-5' : 'size-6'} />
    </span>
  );
}

function OrbitNode({
  icon,
  label,
  style,
  index,
}: {
  icon: PublicIconKey;
  label: string;
  style: { left: string; top: string };
  index: number;
}) {
  void icon;
  const labelClass =
    index === 0
      ? 'bottom-10 left-1/2 w-32 -translate-x-1/2 text-center'
      : index === 1 || index === 3
        ? 'right-10 top-1/2 w-28 -translate-y-1/2 pr-3 text-right'
        : 'left-10 top-1/2 w-28 -translate-y-1/2 pl-3 text-left';
  return (
    <div style={style} className="absolute z-10 size-0">
      <span className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2">
        <HeroNodeBadge feature={index} />
      </span>
      <span className={`absolute text-[11px] font-semibold leading-tight text-pub-navy ${labelClass}`}>{label}</span>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-pub-border bg-white">
      {/* Soft depth behind the copy/chips on mobile and tablet, where the desktop-only
          orbit glow (HeroOrbitBackdrop) isn't rendered. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-pub-blue-light/50 blur-3xl lg:hidden"
      />
      <div className="relative mx-auto max-w-6xl px-4 pb-10 pt-4 sm:px-6 sm:pt-6">
        {/* Desktop: full illustrated orbit. Smaller screens fall back to a plain chip grid below.
            aspect-[2.4/1] renders HeroOrbitBackdrop's 200×100 viewBox stretched flatter/wider —
            preserveAspectRatio="none" there applies that exact same stretch, so the ring and the
            node positions computed below always line up despite the on-screen shape being an
            ellipse rather than a true circle. */}
        <div className="relative mx-auto hidden aspect-[2.4/1] w-full max-w-6xl lg:block">
          <HeroOrbitBackdrop />
          {ORBIT_DOT_POSITIONS.map((style, index) => (
            <span
              key={ORBIT_DOT_ANGLES_DEG[index]}
              aria-hidden="true"
              style={style}
              className="absolute z-[5] size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-pub-blue/55 shadow-[0_0_0_3px_rgba(236,243,255,0.8)]"
            />
          ))}
          {home.hero.chips.map((chip, index) => (
            <OrbitNode key={chip.label} icon={chip.icon} label={chip.label} style={ORBIT_NODE_POSITIONS[index]!} index={index} />
          ))}
        </div>

        <div className="relative z-10 mx-auto max-w-2xl text-center lg:-mt-56">
          <p className="text-xs font-semibold uppercase tracking-widest text-pub-blue">{home.hero.eyebrow}</p>
          <h1 className="mt-4 font-heading text-3xl font-extrabold leading-tight text-pub-navy sm:text-4xl lg:text-5xl">
            {home.hero.heading.map((part) => (
              <span key={part.text} className={part.accent ? 'text-pub-blue' : undefined}>
                {part.text}{' '}
              </span>
            ))}
          </h1>
          <p className="mx-auto mt-4 max-w-md text-base text-pub-muted sm:text-lg lg:max-w-[38rem]">{home.hero.body}</p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              to={home.hero.primaryCta.to}
              className="flex min-h-12 items-center justify-center rounded-lg bg-pub-blue px-6 text-sm font-semibold text-white shadow-sm shadow-pub-blue/30 hover:bg-pub-navy sm:text-base"
            >
              {home.hero.primaryCta.label} →
            </Link>
            <Link
              to={home.hero.secondaryCta.to}
              className="flex min-h-12 items-center justify-center rounded-lg border border-pub-border bg-white px-6 text-sm font-semibold text-pub-navy hover:bg-pub-bg sm:text-base"
            >
              {home.hero.secondaryCta.label} →
            </Link>
          </div>
        </div>

        {/* Mobile / tablet fallback for the orbit nodes. */}
        <div className="mx-auto mt-10 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-3 lg:hidden">
          {home.hero.chips.map((chip, index) => (
            <div
              key={chip.label}
              className={`flex flex-col items-center gap-2 rounded-xl border border-pub-border bg-pub-bg px-3 py-4 text-center ${
                index === 4 ? 'col-span-2 mx-auto w-1/2 min-w-[9rem] sm:col-span-1 sm:mx-0 sm:w-auto sm:min-w-0' : ''
              }`}
            >
              <HeroNodeBadge feature={index} compact />
              <span className="text-xs font-medium text-pub-navy">{chip.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* Stats                                                                    */
/* ---------------------------------------------------------------------- */

function Stats() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="grid grid-cols-2 gap-y-6 rounded-2xl bg-pub-navy p-6 shadow-lg sm:p-8 md:grid-cols-4 md:gap-y-0">
        {home.stats.map((stat, index) => (
          <div
            key={stat.label}
            className={`flex items-center justify-center gap-3 text-left md:border-white/15 ${
              index > 0 ? 'md:border-l md:pl-6' : ''
            }`}
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
              <Icon name={stat.icon} className="size-5" />
            </span>
            <div>
              <p className="font-heading text-xl font-bold text-white sm:text-2xl">{stat.value}</p>
              <p className="text-xs text-white/70 sm:text-sm">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* Who We Serve                                                            */
/* ---------------------------------------------------------------------- */

function Audiences() {
  return (
    <section className="relative overflow-hidden bg-white py-8 sm:py-10 lg:py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 right-0 h-64 w-64 rounded-full bg-pub-blue-light/40 blur-3xl"
      />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading eyebrow="Who We Serve" />
        <div className="mt-6 grid gap-6 md:grid-cols-2">
        {home.audiences.map((audience, index) => (
          <div
            key={audience.title}
            id={index === 0 ? 'for-candidates' : 'for-employers'}
            className="scroll-mt-20 grid gap-2 overflow-hidden rounded-2xl border border-pub-border shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-pub-blue/40 hover:shadow-lg md:grid-cols-2 md:items-stretch"
            style={
              index === 0
                ? { background: 'var(--color-pub-blue-light)' }
                : { background: 'linear-gradient(160deg, #FBEEE1 0%, var(--color-pub-blue-light) 100%)' }
            }
          >
            <div className="flex flex-col justify-center p-6 sm:p-7">
              <div className="flex items-center gap-3">
                <IllustratedBadge size="md">
                  <Icon name={audience.icon} className="size-5" />
                </IllustratedBadge>
                <h2 className="font-heading text-xl font-bold text-pub-navy">{audience.title}</h2>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-pub-muted">{audience.body}</p>
              <ul className="mt-4 space-y-2">
                {audience.points.map((point) => (
                  <li key={point} className="flex items-start gap-2 text-sm text-pub-text">
                    <span aria-hidden="true" className="mt-0.5 text-pub-blue">✓</span>
                    {point}
                  </li>
                ))}
              </ul>
              <Link
                to={audience.cta.to}
                className="mt-5 inline-flex min-h-11 w-fit items-center rounded-lg bg-pub-blue px-5 text-sm font-medium text-white hover:bg-pub-navy"
              >
                {audience.cta.label} →
              </Link>
            </div>

            {/* No panel of its own — the PNG's own transparent background
                lets the card's tinted background above show straight through. */}
            <div className="flex items-end justify-center px-2 pb-2 sm:px-4 md:items-center md:justify-end md:pb-0">
              <img
                src={index === 0 ? candidateIllustrationSrc : employerIllustrationSrc}
                alt={
                  index === 0
                    ? 'Illustration of a candidate building their profile on a laptop'
                    : 'Illustration of an employer reviewing candidates on a laptop'
                }
                className="h-auto w-full max-w-md object-contain"
              />
            </div>
          </div>
        ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* How It Works                                                            */
/* ---------------------------------------------------------------------- */

function StepRow({
  title,
  subtitle,
  icon,
  steps,
}: {
  title: string;
  subtitle: string;
  icon: PublicIconKey;
  steps: readonly { title: string; body: string; icon: PublicIconKey }[];
}) {
  return (
    <div className="grid gap-6 rounded-2xl border border-pub-border bg-gradient-to-br from-white to-pub-blue-light/20 p-6 shadow-sm transition-all duration-200 hover:border-pub-blue/30 hover:shadow-md sm:p-7 md:grid-cols-[248px_1fr] md:items-center">
      <div className="flex items-center gap-4 rounded-xl bg-pub-navy p-5 text-white">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-white/15">
          <Icon name={icon} className="size-7" />
        </span>
        <div>
          <h3 className="font-heading text-base font-bold">{title}</h3>
          <p className="mt-1.5 text-sm text-white/75">{subtitle}</p>
        </div>
      </div>

      <div className="process-flow relative grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-4">
        <div
          aria-hidden="true"
          className="absolute top-7 hidden border-t border-pub-blue/35 sm:block"
          style={{ left: 'calc((100% - 3rem) / 8)', right: 'calc((100% - 3rem) / 8)' }}
        />
        {[25, 50, 75].map((left) => (
          <span
            key={left}
            aria-hidden="true"
            style={{ left: `${left}%` }}
            className="absolute top-7 z-10 hidden size-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center text-pub-blue sm:flex"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-3">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </span>
        ))}
        {steps.map((step, index) => (
          <div key={step.title} className="process-step relative z-10 flex flex-col items-center text-center">
            <IllustratedBadge size="lg" tone="outline">
              <Icon name={step.icon} className="size-5" />
            </IllustratedBadge>
            <p className="mt-2.5 text-[10px] font-semibold uppercase tracking-wide text-pub-blue">
              Step {index + 1}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-pub-navy">{step.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-pub-muted">{step.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 relative overflow-hidden bg-pub-bg py-8 sm:py-10 lg:py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 top-0 h-64 w-64 rounded-full bg-pub-blue-light/50 blur-3xl"
      />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading eyebrow="How It Works" />
        <div className="mt-6 space-y-4">
          <StepRow
            title={home.howItWorksCandidate.title}
            subtitle={home.howItWorksCandidate.subtitle}
            icon="users"
            steps={home.howItWorksCandidate.steps}
          />
          <StepRow
            title={home.howItWorksEmployer.title}
            subtitle={home.howItWorksEmployer.subtitle}
            icon="building"
            steps={home.howItWorksEmployer.steps}
          />
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* Why Us                                                                   */
/* ---------------------------------------------------------------------- */

function WhyUs() {
  return (
    <section className="relative overflow-hidden bg-white py-8 sm:py-10 lg:py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-16 left-1/2 h-64 w-[32rem] -translate-x-1/2 rounded-full bg-pub-blue-light/40 blur-3xl"
      />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading eyebrow="Why BK Talent Connect" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {home.whyUs.map((item) => (
            <div key={item.title} className="rounded-xl border border-pub-border bg-white p-5 text-center shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-pub-blue/40 hover:shadow-md">
              <IllustratedBadge size="lg" tone="outline" className="mx-auto">
                <Icon name={item.icon} className="size-6" />
              </IllustratedBadge>
              <h3 className="mt-3 font-heading text-sm font-bold text-pub-navy">{item.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-pub-muted">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* Industries                                                              */
/* ---------------------------------------------------------------------- */

function Industries() {
  return (
    <section id="industries" className="scroll-mt-20 bg-pub-bg py-8 sm:py-10 lg:py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading eyebrow="Industries We Serve" />
        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 rounded-2xl border border-pub-border bg-white p-6 shadow-sm sm:grid-cols-3 sm:p-8 lg:grid-cols-6 lg:gap-y-0 lg:divide-x lg:divide-pub-border">
          {home.industries.map((industry) => (
            <div key={industry.name} className="flex flex-col items-center gap-2.5 text-center lg:px-2">
              <Icon name={industry.icon} className="size-7 text-pub-blue" />
              <span className="text-xs font-medium leading-tight text-pub-navy">{industry.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* Approach                                                                 */
/* ---------------------------------------------------------------------- */

function Approach() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:py-10 lg:py-10 sm:px-6">
      <div className="grid gap-8 rounded-2xl bg-pub-blue-light p-6 sm:p-8 lg:grid-cols-2 lg:items-center">
        <div>
          <h2 className="font-heading text-2xl font-bold leading-tight text-pub-navy sm:text-3xl">
            {home.approach.heading.map((part) => (
              <span key={part.text} className={part.accent ? 'text-pub-blue' : undefined}>
                {part.text}{' '}
              </span>
            ))}
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-pub-muted sm:text-base">{home.approach.body}</p>
          <ul className="mt-5 space-y-2.5">
            {home.approach.points.map((point) => (
              <li key={point} className="flex items-start gap-2 text-sm text-pub-text">
                <span aria-hidden="true" className="mt-0.5 text-pub-blue">✓</span>
                {point}
              </li>
            ))}
          </ul>
        </div>

        <RecruitmentDashboardArt rows={home.approach.pipelinePreview} className="mx-auto w-full max-w-md" />
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* Contact                                                                  */
/* ---------------------------------------------------------------------- */

function ContactBand() {
  const { contact } = home;
  return (
    <section id="contact" className="scroll-mt-20 bg-white py-8 sm:py-10 lg:py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="relative grid gap-8 overflow-hidden rounded-2xl bg-pub-navy p-6 text-white sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-pub-blue/30 blur-3xl" />
          <h2 className="relative font-heading text-xl font-bold sm:text-2xl">{contact.heading}</h2>
          <div className="relative grid gap-3 sm:grid-cols-3 lg:w-[46rem]">
            <ContactTile {...contact.whatsapp} />
            <ContactTile {...contact.email} />
            <ContactTile {...contact.phone} />
          </div>
        </div>
      </div>
    </section>
  );
}

function ContactTile({
  label,
  value,
  href,
  icon,
}: {
  label: string;
  value: string;
  href: string;
  icon: PublicIconKey;
}) {
  const isPlaceholder = value.startsWith('[TBC');
  // WhatsApp keeps its recognizable brand green (matches the floating CTA
  // elsewhere on the site); every other channel stays on the blue system.
  const isWhatsApp = icon === 'whatsapp';
  return (
    <a
      href={href}
      aria-disabled={isPlaceholder || undefined}
      onClick={isPlaceholder ? (event) => event.preventDefault() : undefined}
      className={`flex min-w-0 items-center gap-3 rounded-xl bg-white p-3 text-sm shadow-sm transition-all duration-200 ${
        isPlaceholder ? 'cursor-default opacity-70' : 'hover:-translate-y-0.5 hover:shadow-md'
      }`}
    >
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
          isWhatsApp ? 'bg-emerald-50 text-emerald-600' : 'bg-pub-blue-light text-pub-blue'
        }`}
      >
        <Icon name={icon} className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <p className="font-semibold text-pub-navy">{label}</p>
        <p className="mt-0.5 break-words text-xs text-pub-muted">{value}</p>
      </span>
    </a>
  );
}
