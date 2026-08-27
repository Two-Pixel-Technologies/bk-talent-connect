/**
 * Public "For Employers" page (P9).
 *
 * Marketing/info page only — no data fetching, no backend changes. Every CTA
 * routes into flows that already exist (registration, login); nothing here
 * duplicates auth, job, or applicant logic, and nothing here is gated
 * behind auth. This is the public page — the authenticated employer portal
 * (company profile, job editor, applicant pipeline) is untouched.
 */

import type { ComponentType } from 'react';
import { Link } from 'react-router-dom';
import { PUBLIC_ICONS, type PublicIconKey } from '../../components/icons/public-icons.js';
import {
  IllustratedBadge,
  VerifiedTalentArt,
  ScreeningArt,
  GrowthChartArt,
  EmployerDashboardArt,
  IllustrationGlow,
  DotCluster,
} from '../../components/illustrations/public-illustrations.js';
import { home, forEmployers } from '../../content/site.js';
import employerTargetSrc from '../../assets/illustrations/employer-target-transparent.png';

type IconComp = ComponentType<{ className: string }>;

function Icon({ name, className }: { name: PublicIconKey; className: string }) {
  const Cmp = PUBLIC_ICONS[name] as IconComp;
  return <Cmp className={className} />;
}

const ART: Record<'verifiedTalent' | 'screening' | 'growth', ComponentType<{ className?: string }>> = {
  verifiedTalent: VerifiedTalentArt,
  screening: ScreeningArt,
  growth: GrowthChartArt,
};

export function ForEmployersPage() {
  return (
    <main className="public-site employers-public mobile-refine-scope overflow-x-clip">
      <Hero />
      <Stats />
      <WhyChoose />
      <HowItWorks />
      <WhatYouCanDo />
      <Industries />
      <FinalCta />
    </main>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-pub-blue">{eyebrow}</p>
      <h2 className="mt-2 font-heading text-2xl font-bold text-pub-navy sm:text-3xl">{title}</h2>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Hero — a deep-navy organic shape on the left flowing into a clean white  */
/* right side, where the hub-and-spoke orbit sits. Colors here are the      */
/* exact values requested for this hero (#0A2E73 / #2563EB) rather than     */
/* the site's --color-pub-navy/--color-pub-blue tokens, which stay          */
/* untouched for every other section.                                      */
/* ---------------------------------------------------------------------- */

const HERO_NAVY = '#0A2E73';
const HERO_BLUE = '#2563EB';

function OrbitNode({
  icon,
  label,
  className,
  labelClassName,
  center = false,
}: {
  icon: PublicIconKey;
  label: string;
  className: string;
  labelClassName: string;
  center?: boolean;
}) {
  return (
    <div className={`absolute z-10 size-0 ${className}`}>
      <span
        className={`absolute left-0 top-0 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full shadow-md ring-1 ring-black/5 ${
          center ? 'size-14 text-white shadow-lg sm:size-20' : 'size-11 bg-white text-[#2563EB] sm:size-14'
        }`}
        style={center ? { background: HERO_BLUE } : undefined}
      >
        <Icon name={icon} className={center ? 'size-6 sm:size-9' : 'size-5 sm:size-6'} />
      </span>
      <span
        className={`absolute z-20 rounded bg-white/95 px-1 text-[10px] font-semibold leading-tight sm:text-xs ${center ? 'text-[#0A2E73]' : 'text-pub-navy'} ${labelClassName}`}
      >
        {label}
      </span>
    </div>
  );
}

function HeroOrbit() {
  const { orbit } = forEmployers.hero;
  return (
    <div className="relative mx-auto hidden h-72 w-72 max-w-full sm:block sm:h-[21rem] sm:w-[21rem] lg:h-[21rem] lg:w-[21rem] xl:h-[27rem] xl:w-[27rem]">
      <svg viewBox="0 0 340 340" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full">
        <circle cx="170" cy="170" r="104" fill="none" stroke="#2563EB" strokeOpacity="0.34" strokeWidth="1.5" strokeDasharray="1 8" />
        <line x1="170" y1="170" x2="170" y2="40" stroke="#2563EB" strokeOpacity="0.34" strokeWidth="1.5" />
        <line x1="170" y1="170" x2="300" y2="170" stroke="#2563EB" strokeOpacity="0.34" strokeWidth="1.5" />
        <line x1="170" y1="170" x2="170" y2="300" stroke="#2563EB" strokeOpacity="0.34" strokeWidth="1.5" />
        <line x1="170" y1="170" x2="40" y2="170" stroke="#2563EB" strokeOpacity="0.34" strokeWidth="1.5" />
      </svg>

      <OrbitNode icon="building" label="Your Business" className="left-1/2 top-1/2" labelClassName="left-1/2 top-12 w-28 -translate-x-1/2 text-center" center />
      <OrbitNode icon={orbit[0]!.icon} label={orbit[0]!.label} className="left-1/2 top-[12%]" labelClassName="bottom-11 left-1/2 w-32 -translate-x-1/2 text-center" />
      <OrbitNode icon={orbit[1]!.icon} label={orbit[1]!.label} className="left-[12%] top-1/2" labelClassName="right-11 top-1/2 w-28 -translate-y-1/2 text-right lg:w-16" />
      <OrbitNode icon={orbit[2]!.icon} label={orbit[2]!.label} className="right-[12%] top-1/2" labelClassName="left-11 top-1/2 w-28 -translate-y-1/2 text-left" />
      <OrbitNode icon={orbit[3]!.icon} label={orbit[3]!.label} className="bottom-[12%] left-1/2" labelClassName="left-1/2 top-11 w-32 -translate-x-1/2 text-center" />
    </div>
  );
}

function EmployerMobileWidget() {
  const { orbit } = forEmployers.hero;
  const positions = [
    'left-1/2 top-7 -translate-x-1/2',
    'left-4 top-1/2 -translate-y-1/2',
    'right-4 top-1/2 -translate-y-1/2',
    'bottom-7 left-1/2 -translate-x-1/2',
  ] as const;
  const labelPositions = [
    'bottom-[3.25rem] left-1/2 -translate-x-1/2',
    'left-1/2 top-12 -translate-x-1/2',
    'left-1/2 top-12 -translate-x-1/2',
    'left-1/2 top-[3.25rem] -translate-x-1/2',
  ] as const;
  return (
    <div className="relative mx-auto h-[19rem] w-full max-w-[19rem] sm:hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-10 rounded-full bg-pub-blue-light/45 blur-2xl" />
      <svg viewBox="0 0 304 304" aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 size-full">
        <circle cx="152" cy="152" r="105" fill="none" stroke={HERO_BLUE} strokeOpacity="0.3" strokeWidth="1.5" strokeDasharray="1 7" />
        <line x1="152" y1="76" x2="152" y2="120" stroke={HERO_BLUE} strokeOpacity="0.28" strokeWidth="1.5" />
        <line x1="64" y1="152" x2="120" y2="152" stroke={HERO_BLUE} strokeOpacity="0.28" strokeWidth="1.5" />
        <line x1="184" y1="152" x2="240" y2="152" stroke={HERO_BLUE} strokeOpacity="0.28" strokeWidth="1.5" />
        <line x1="152" y1="184" x2="152" y2="228" stroke={HERO_BLUE} strokeOpacity="0.28" strokeWidth="1.5" />
      </svg>

      <div className="absolute left-1/2 top-1/2 z-20 size-16 -translate-x-1/2 -translate-y-1/2">
        <span className="flex size-16 items-center justify-center rounded-full bg-pub-blue text-white shadow-lg ring-4 ring-white">
          <Icon name="building" className="size-7" />
        </span>
        <span className="absolute left-1/2 top-[4.5rem] w-24 -translate-x-1/2 rounded bg-white/90 px-1 text-center text-[11px] font-bold leading-tight text-pub-navy">
          Your Business
        </span>
      </div>

      {orbit.map((item, index) => (
          <div key={item.label} className={`absolute z-10 size-12 ${positions[index]}`}>
            <span className="flex size-12 items-center justify-center rounded-full border border-pub-blue/20 bg-white text-pub-blue shadow-md ring-2 ring-pub-blue-light/70">
              <Icon name={item.icon} className="size-5" />
            </span>
            <span className={`absolute z-20 w-20 rounded bg-white/90 px-1 text-center text-[10px] font-semibold leading-tight text-pub-navy min-[360px]:w-24 min-[360px]:text-[11px] ${labelPositions[index]}`}>
              {item.label}
            </span>
          </div>
      ))}
    </div>
  );
}

/** The organic navy shape, desktop-only — mobile/tablet use a solid block instead (see Hero). */
function HeroCurve() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1000 620"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block"
    >
      <path
        d="M0,0 L560,0 C650,40 600,110 560,160 C520,210 460,260 470,320 C480,400 440,460 450,530 C455,560 430,590 440,620 L0,620 Z"
        fill={HERO_NAVY}
      />
      <g opacity="0.35">
        {Array.from({ length: 6 }, (_, row) =>
          Array.from({ length: 9 }, (_, col) => (
            <circle key={`${row}-${col}`} cx={28 + col * 22} cy={28 + row * 22} r="2" fill="#2563EB" />
          )),
        )}
      </g>
    </svg>
  );
}

function Hero() {
  const { hero } = forEmployers;
  return (
    <section className="relative overflow-hidden bg-white">
      <HeroCurve />

      {/* Same max-w-6xl + px-4/sm:px-6 container as every other section on
          this page — the hero previously zeroed this out at lg: and let the
          text div re-pad itself, which is why it drifted out of alignment
          with the rest of the site. */}
      <div className="relative mx-auto grid max-w-6xl gap-x-12 gap-y-10 px-4 py-8 sm:px-6 sm:py-10 lg:grid-cols-[45%_55%] lg:items-center lg:py-16">
        <div className="rounded-2xl bg-[#0A2E73] px-6 py-8 sm:px-10 sm:py-10 lg:rounded-none lg:bg-transparent lg:px-0 lg:py-0">
          <h1 className="font-heading text-3xl font-extrabold leading-[1.12] text-white sm:text-4xl lg:text-5xl">
            {hero.heading.map((part) => (
              <span key={part.text} className="block" style={part.accent ? { color: '#8FB4FF' } : undefined}>
                {part.text}
              </span>
            ))}
          </h1>
          <p className="mt-5 max-w-sm text-base text-white/75 sm:text-lg">{hero.body}</p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              to={hero.primaryCta.to}
              className="inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-6 text-sm font-semibold text-white shadow-md hover:brightness-110 sm:text-base"
              style={{ background: HERO_BLUE }}
            >
              {hero.primaryCta.label}
              <span aria-hidden="true">→</span>
            </Link>
            <a
              href={hero.secondaryCta.to}
              className="inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-white/25 px-6 text-sm font-semibold text-white hover:bg-white/10 sm:text-base"
            >
              {hero.secondaryCta.label}
              <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>

        <div className="flex items-center justify-center">
          <EmployerMobileWidget />
          <HeroOrbit />
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* Stats — a white card (distinct from the navy stats band elsewhere),     */
/* using the same data as Home so the numbers never disagree.              */
/* ---------------------------------------------------------------------- */

function Stats() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="grid grid-cols-2 gap-y-6 rounded-2xl border border-pub-border bg-gradient-to-br from-white to-pub-blue-light/20 p-6 shadow-sm sm:p-8 md:grid-cols-4 md:gap-y-0">
        {home.stats.map((stat, index) => (
          <div
            key={stat.label}
            className={`flex items-center justify-center gap-3 md:border-pub-border ${index > 0 ? 'md:border-l' : ''}`}
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-pub-blue-light text-pub-blue">
              <Icon name={stat.icon} className="size-5" />
            </span>
            <div>
              <p className="font-heading text-lg font-bold text-pub-navy sm:text-xl">{stat.value}</p>
              <p className="text-xs text-pub-muted sm:text-sm">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* Why Employers Choose Us                                                 */
/* ---------------------------------------------------------------------- */

function WhyChoose() {
  return (
    <section className="relative overflow-hidden bg-white py-8 sm:py-10 lg:py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-20 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-pub-blue-light/50 blur-3xl"
      />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading eyebrow="Why Employers Choose Us" title="A better way to hire" />
        <div className="mt-8 grid gap-8 divide-y divide-pub-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {forEmployers.whyChoose.map((item) => {
            const Art = ART[item.art];
            return (
              <div key={item.title} className="flex flex-col items-center px-4 pt-8 text-center first:pt-0 sm:pt-0">
                <Art className="h-32 w-auto" />
                <h3 className="mt-4 font-heading text-base font-bold text-pub-navy">{item.title}</h3>
                <p className="mt-1.5 max-w-[15rem] text-sm leading-relaxed text-pub-muted">{item.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* How It Works — Employer Journey                                         */
/* ---------------------------------------------------------------------- */

function HowItWorks() {
  const steps = forEmployers.howItWorks.steps;
  return (
    <section id="how-it-works" className="scroll-mt-20 relative overflow-hidden bg-pub-bg py-8 sm:py-10 lg:py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 top-0 h-64 w-64 rounded-full bg-pub-blue-light/60 blur-3xl"
      />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading eyebrow="How It Works" title={forEmployers.howItWorks.title} />

        <div className="process-flow relative mt-8 grid grid-cols-1 gap-x-4 gap-y-8 rounded-2xl border border-pub-border bg-gradient-to-br from-white to-pub-blue-light/30 p-6 shadow-sm sm:p-8 md:grid-cols-5">
          <div
            aria-hidden="true"
            className="absolute top-[60px] hidden border-t border-pub-blue/35 md:block"
            style={{ left: 'calc(2rem + (100% - 8rem) / 10)', right: 'calc(2rem + (100% - 8rem) / 10)' }}
          />
          {[20, 40, 60, 80].map((left) => (
            <span
              key={left}
              aria-hidden="true"
              style={{ left: `${left}%` }}
              className="absolute top-[60px] z-10 hidden size-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center text-pub-blue md:flex"
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
                {String(index + 1).padStart(2, '0')}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-pub-navy">{step.title}</p>
              <p className="mt-1 max-w-[10rem] text-xs leading-relaxed text-pub-muted">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* What You Can Do                                                         */
/* ---------------------------------------------------------------------- */

function WhatYouCanDo() {
  const { whatYouCanDo } = forEmployers;
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-pub-blue-light/40 via-white to-white py-8 sm:py-10 lg:py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-pub-blue-light/50 blur-3xl"
      />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading eyebrow="What You Can Do" title={whatYouCanDo.heading} />
        <div className="mt-8 grid gap-10 lg:grid-cols-2 lg:items-center">
          <div className="relative mx-auto w-full max-w-md">
            <IllustrationGlow className="inset-6" />
            <DotCluster className="left-0 top-0 h-14 w-16" />
            <EmployerDashboardArt
              counts={whatYouCanDo.dashboard.counts}
              rows={whatYouCanDo.dashboard.rows}
              className="relative mx-auto h-auto w-full"
            />
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
          {whatYouCanDo.items.map((item) => (
            <div key={item.title} className="flex items-start gap-3">
              <IllustratedBadge size="md" tone="outline">
                <Icon name={item.icon} className="size-5" />
              </IllustratedBadge>
              <div>
                <h3 className="font-heading text-sm font-bold text-pub-navy">{item.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-pub-muted">{item.body}</p>
              </div>
            </div>
          ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* Industries — reuses Home's industries data and strip styling.           */
/* ---------------------------------------------------------------------- */

function Industries() {
  return (
    <section id="industries" className="scroll-mt-20 relative overflow-hidden bg-pub-bg py-8 sm:py-10 lg:py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 top-0 h-56 w-56 rounded-full bg-pub-blue-light/40 blur-3xl"
      />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading eyebrow="Industries We Serve" title="Roles we help you fill" />
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-6 rounded-2xl border border-pub-border bg-white p-6 shadow-sm sm:grid-cols-3 sm:p-8 lg:grid-cols-6 lg:gap-y-0 lg:divide-x lg:divide-pub-border">
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
/* Final CTA                                                               */
/* ---------------------------------------------------------------------- */

function FinalCta() {
  const { finalCta } = forEmployers;
  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:py-10 lg:py-10 sm:px-6">
      <div className="relative grid gap-8 overflow-hidden rounded-2xl bg-pub-blue-light p-6 sm:p-10 lg:grid-cols-[auto_1fr_auto] lg:items-center">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/40 blur-3xl" />
        <img
          src={employerTargetSrc}
          alt=""
          aria-hidden="true"
          className="relative mx-auto h-32 w-48 object-contain sm:h-40 sm:w-60"
        />
        <div className="relative">
          <h2 className="font-heading text-2xl font-bold text-pub-navy sm:text-3xl">{finalCta.heading}</h2>
          <p className="mt-2 max-w-md text-sm text-pub-muted sm:text-base">{finalCta.body}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
          <Link
            to={finalCta.primaryCta.to}
            className="flex min-h-12 items-center justify-center rounded-lg bg-pub-blue px-6 text-sm font-semibold text-white hover:bg-pub-navy"
          >
            {finalCta.primaryCta.label} →
          </Link>
          <a
            href={finalCta.secondaryCta.to}
            className="flex min-h-12 items-center justify-center rounded-lg border border-pub-border bg-white px-6 text-sm font-semibold text-pub-navy hover:bg-pub-bg"
          >
            {finalCta.secondaryCta.label} →
          </a>
        </div>
      </div>
    </section>
  );
}
