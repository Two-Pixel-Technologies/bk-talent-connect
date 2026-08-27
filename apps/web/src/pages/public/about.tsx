/**
 * Public "About Us" page (P9).
 *
 * Marketing/info page only — no data fetching, no backend changes. CTAs
 * route into flows that already exist (registration); nothing here
 * duplicates auth logic, and nothing here is gated behind auth.
 */

import type { ComponentType } from 'react';
import { Link } from 'react-router-dom';
import { PUBLIC_ICONS, type PublicIconKey } from '../../components/icons/public-icons.js';
import { IllustratedBadge, IllustrationGlow, DotCluster } from '../../components/illustrations/public-illustrations.js';
import { home, aboutUs } from '../../content/site.js';
import aboutHeroTeamSrc from '../../assets/illustrations/about-hero-team-transparent.png';
import aboutStoryTeamSrc from '../../assets/illustrations/about-story-team-transparent.png';
import aboutCtaHighfiveSrc from '../../assets/illustrations/about-cta-highfive-transparent.png';

type IconComp = ComponentType<{ className: string }>;

function Icon({ name, className }: { name: PublicIconKey; className: string }) {
  const Cmp = PUBLIC_ICONS[name] as IconComp;
  return <Cmp className={className} />;
}

export function AboutPage() {
  return (
    <main className="public-site about-public overflow-x-clip">
      <Hero />
      <Values />
      <Story />
      <HiringApproach />
      <Impact />
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
/* Hero                                                                    */
/* ---------------------------------------------------------------------- */

function Hero() {
  const { hero } = aboutUs;
  return (
    <section className="relative overflow-hidden border-b border-pub-border bg-white">
      {/* Soft layered depth behind the copy/illustration so the hero doesn't read as flat white. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 right-0 h-96 w-96 rounded-full bg-pub-blue-light blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-pub-blue-light/60 blur-3xl"
      />
      <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-8 sm:px-6 sm:py-10 lg:py-14 lg:grid-cols-2 lg:items-center">
        <div className="order-2 text-center lg:order-1 lg:text-left">
          <h1 className="font-heading text-3xl font-extrabold leading-[1.1] text-pub-navy sm:text-4xl lg:text-5xl">
            {hero.heading.map((part) => (
              <span key={part.text} className={part.accent ? 'block text-pub-blue' : 'block'}>
                {part.text}
              </span>
            ))}
          </h1>
          <span aria-hidden="true" className="mx-auto mt-4 block h-1 w-14 rounded-full bg-pub-blue lg:mx-0" />
          <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-pub-muted sm:text-lg lg:mx-0">{hero.body}</p>
        </div>

        {/* An organic glow (not a hard-edged box) plus sparse dots sit behind the
            illustration so it reads as integrated into the section. */}
        <div className="relative order-1 mx-auto w-full max-w-xl lg:order-2 lg:max-w-none">
          <IllustrationGlow className="inset-x-10 inset-y-6 sm:inset-x-14 sm:inset-y-10" />
          <DotCluster className="right-2 top-0 h-16 w-20 sm:right-6" />
          <img
            src={aboutHeroTeamSrc}
            alt="Our team collaborating in the office"
            className="relative h-auto w-full object-contain"
          />
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* Values                                                                   */
/* ---------------------------------------------------------------------- */

function Values() {
  return (
    <section className="relative overflow-hidden bg-white py-8 sm:py-10 lg:py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 right-0 h-64 w-64 rounded-full bg-pub-blue-light/50 blur-3xl"
      />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 rounded-2xl border border-pub-border bg-white p-6 shadow-sm sm:gap-x-6 sm:gap-y-8 sm:p-8 md:grid-cols-4 md:divide-x md:divide-pub-border">
          {aboutUs.values.map((item, index) => (
            <div
              key={item.title}
              className={`flex flex-col items-center text-center md:px-4 ${
                index >= 2 ? 'border-t border-pub-border pt-6 md:border-t-0 md:pt-0' : ''
              }`}
            >
              <Icon name={item.icon} className="size-9 text-pub-blue" />
              <h3 className="mt-4 font-heading text-base font-bold text-pub-navy">{item.title}</h3>
              <p className="mt-1.5 max-w-[14rem] text-sm leading-relaxed text-pub-muted">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* Our Story                                                                */
/* ---------------------------------------------------------------------- */

/** Purely visual — story.stats has no icon field, so map by position (clock/people/award reads naturally for years/clients/placements). */
const STORY_STAT_ICONS: readonly PublicIconKey[] = ['clock', 'users', 'award'];

function Story() {
  const { story } = aboutUs;
  return (
    <section className="relative overflow-hidden bg-pub-bg py-8 sm:py-10 lg:py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-pub-blue-light/50 blur-3xl"
      />
      <div className="relative mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
        {/* Image first — both on mobile (stacked) and on desktop (left column), matching
            the reference's alternating rhythm with the hero above. */}
        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <IllustrationGlow className="inset-x-8 inset-y-4 sm:inset-x-10 sm:inset-y-6" />
          <DotCluster className="bottom-0 left-2 h-14 w-16" />
          <img
            src={aboutStoryTeamSrc}
            alt="Our team reviewing candidate and hiring data together"
            className="relative h-auto w-full object-contain"
          />
        </div>

        <div className="text-center lg:text-left">
          <p className="text-xs font-semibold uppercase tracking-widest text-pub-blue">{story.eyebrow}</p>
          <h2 className="mt-2 font-heading text-2xl font-bold leading-tight text-pub-navy sm:text-3xl">
            {story.heading.map((part) => (
              <span key={part.text} className={part.accent ? 'block text-pub-blue' : 'block'}>
                {part.text}
              </span>
            ))}
          </h2>
          <span aria-hidden="true" className="mx-auto mt-3 block h-1 w-14 rounded-full bg-pub-blue lg:mx-0" />
          <p className="mt-4 text-sm leading-relaxed text-pub-muted sm:text-base">{story.body}</p>

          <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-pub-border bg-white p-5 text-left shadow-sm sm:flex-row sm:flex-wrap sm:gap-8 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
            {story.stats.map((stat, index) => (
              <div key={stat.label} className="flex items-center gap-3">
                <Icon name={STORY_STAT_ICONS[index] ?? 'award'} className="size-6 shrink-0 text-pub-blue" />
                <div>
                  <p className="font-heading text-xl font-bold text-pub-navy sm:text-2xl">{stat.value}</p>
                  <p className="text-xs text-pub-muted sm:text-sm">{stat.label}</p>
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
/* Hiring Approach — a 4-step connected flow, same visual language as the  */
/* "How It Works" rows on Home/For Employers, but the company's own        */
/* end-to-end approach rather than a candidate- or employer-specific path. */
/* ---------------------------------------------------------------------- */

function HiringApproach() {
  const { approach } = aboutUs;
  return (
    <section className="relative overflow-hidden bg-white py-8 sm:py-10 lg:py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 top-0 h-64 w-64 rounded-full bg-pub-blue-light/50 blur-3xl"
      />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-pub-blue">{approach.eyebrow}</p>
          <h2 className="mt-2 font-heading text-2xl font-bold leading-tight text-pub-navy sm:text-3xl">
            {approach.heading.map((part) => (
              <span key={part.text} className={part.accent ? 'text-pub-blue' : undefined}>
                {part.text}{' '}
              </span>
            ))}
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-pub-muted sm:text-base">{approach.body}</p>
        </div>

        <div className="process-flow relative mt-8 grid grid-cols-1 gap-x-4 gap-y-8 rounded-2xl border border-pub-border bg-gradient-to-br from-white to-pub-blue-light/30 p-6 shadow-sm sm:p-8 md:grid-cols-4">
          <div
            aria-hidden="true"
            className="absolute top-[60px] hidden border-t border-pub-blue/35 md:block"
            style={{ left: 'calc(2rem + (100% - 7rem) / 8)', right: 'calc(2rem + (100% - 7rem) / 8)' }}
          />
          {[25, 50, 75].map((left) => (
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
          {approach.steps.map((step, index) => (
            <div key={step.title} className="process-step relative z-10 flex flex-col items-center text-center">
              <IllustratedBadge size="lg" tone="outline">
                <Icon name={step.icon} className="size-5" />
              </IllustratedBadge>
              <p className="mt-2.5 text-[10px] font-semibold uppercase tracking-wide text-pub-blue">
                {String(index + 1).padStart(2, '0')}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-pub-navy">{step.title}</p>
              <p className="mt-1 max-w-[11rem] text-xs leading-relaxed text-pub-muted">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* Impact — reuses Home's real stats so the numbers never disagree.        */
/* ---------------------------------------------------------------------- */

function Impact() {
  return (
    <section className="relative overflow-hidden bg-pub-bg px-4 py-8 sm:py-10 lg:py-10 sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-16 top-0 h-56 w-56 rounded-full bg-pub-blue-light/40 blur-3xl"
      />
      <div className="relative mx-auto max-w-6xl">
        <SectionHeading eyebrow={aboutUs.impact.eyebrow} title={aboutUs.impact.heading} />
        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {home.stats.map((stat) => (
            <div
              key={stat.label}
              className="flex h-full items-center gap-3 rounded-2xl border border-pub-border bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-pub-blue/40 hover:shadow-md"
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
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* Final CTA                                                               */
/* ---------------------------------------------------------------------- */

function FinalCta() {
  const { finalCta } = aboutUs;
  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:py-10 lg:py-10 sm:px-6">
      <div className="relative grid gap-8 overflow-hidden rounded-2xl bg-pub-navy p-6 text-white sm:p-10 lg:grid-cols-[auto_1fr_auto] lg:items-center">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-pub-blue/30 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <img
          src={aboutCtaHighfiveSrc}
          alt=""
          aria-hidden="true"
          className="relative hidden h-32 w-auto object-contain sm:block"
        />
        <div className="relative">
          <h2 className="font-heading text-2xl font-bold sm:text-3xl">{finalCta.heading}</h2>
          <p className="mt-2 max-w-md text-sm text-white/75 sm:text-base">{finalCta.body}</p>
        </div>
        <div className="relative flex flex-col gap-3 sm:flex-row lg:flex-col">
          <Link
            to={finalCta.primaryCta.to}
            className="inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-white px-6 text-sm font-semibold text-pub-navy hover:bg-pub-blue-light"
          >
            {finalCta.primaryCta.label} →
          </Link>
          <Link
            to={finalCta.secondaryCta.to}
            className="inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-white/25 px-6 text-sm font-semibold text-white hover:bg-white/10"
          >
            {finalCta.secondaryCta.label} →
          </Link>
        </div>
      </div>
    </section>
  );
}
