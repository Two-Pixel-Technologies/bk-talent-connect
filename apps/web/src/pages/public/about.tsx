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
import { IllustratedBadge } from '../../components/illustrations/public-illustrations.js';
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
    <main className="overflow-x-clip">
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
    <section className="border-b border-pub-border bg-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-8 sm:px-6 sm:py-10 lg:py-12 lg:grid-cols-2 lg:items-center">
        <div>
          <h1 className="font-heading text-3xl font-extrabold leading-[1.1] text-pub-navy sm:text-4xl lg:text-5xl">
            {hero.heading.map((part) => (
              <span key={part.text} className={part.accent ? 'block text-pub-blue' : 'block'}>
                {part.text}
              </span>
            ))}
          </h1>
          <span aria-hidden="true" className="mt-4 block h-1 w-14 rounded-full bg-pub-blue" />
          <p className="mt-5 max-w-lg text-base leading-relaxed text-pub-muted sm:text-lg">{hero.body}</p>
        </div>

        <img
          src={aboutHeroTeamSrc}
          alt="Our team collaborating in the office"
          className="h-auto w-full object-contain"
        />
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* Values                                                                   */
/* ---------------------------------------------------------------------- */

function Values() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:py-10 lg:py-12 sm:px-6">
      <div className="grid gap-8 divide-y divide-pub-border rounded-2xl border border-pub-border bg-white p-6 shadow-sm sm:p-8 md:grid-cols-4 md:divide-x md:divide-y-0">
        {aboutUs.values.map((item) => (
          <div key={item.title} className="flex flex-col items-center pt-8 text-center first:pt-0 md:px-4 md:pt-0">
            <IllustratedBadge size="lg" tone="outline">
              <Icon name={item.icon} className="size-6" />
            </IllustratedBadge>
            <h3 className="mt-4 font-heading text-base font-bold text-pub-navy">{item.title}</h3>
            <p className="mt-1.5 max-w-[14rem] text-sm leading-relaxed text-pub-muted">{item.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* Our Story                                                                */
/* ---------------------------------------------------------------------- */

function Story() {
  const { story } = aboutUs;
  return (
    <section className="bg-pub-bg py-8 sm:py-10 lg:py-12">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-pub-blue">{story.eyebrow}</p>
          <h2 className="mt-2 font-heading text-2xl font-bold leading-tight text-pub-navy sm:text-3xl">
            {story.heading.map((part) => (
              <span key={part.text} className={part.accent ? 'block text-pub-blue' : 'block'}>
                {part.text}
              </span>
            ))}
          </h2>
          <span aria-hidden="true" className="mt-3 block h-1 w-14 rounded-full bg-pub-blue" />
          <p className="mt-4 text-sm leading-relaxed text-pub-muted sm:text-base">{story.body}</p>

          <div className="mt-6 grid max-w-sm grid-cols-2 gap-4 sm:max-w-none sm:flex sm:flex-wrap sm:gap-8">
            {story.stats.map((stat, index) => (
              <div
                key={stat.label}
                className={`rounded-xl border border-pub-border bg-white p-4 shadow-sm sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none ${
                  story.stats.length % 2 === 1 && index === story.stats.length - 1
                    ? 'col-span-2 mx-auto w-1/2 min-w-[8rem]'
                    : ''
                }`}
              >
                <p className="font-heading text-2xl font-bold text-pub-navy">{stat.value}</p>
                <p className="text-xs text-pub-muted sm:text-sm">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        <img
          src={aboutStoryTeamSrc}
          alt="Our team reviewing candidate and hiring data together"
          className="h-auto w-full object-contain"
        />
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
    <section className="bg-pub-bg py-8 sm:py-10 lg:py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
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

        <div className="relative mt-8 grid grid-cols-2 gap-x-4 gap-y-8 rounded-2xl border border-pub-border bg-white p-6 sm:p-8 md:grid-cols-4">
          <div
            aria-hidden="true"
            className="absolute inset-x-10 top-[52px] hidden border-t-2 border-dashed border-pub-blue/30 md:block"
          />
          {[25, 50, 75].map((left) => (
            <span
              key={left}
              aria-hidden="true"
              style={{ left: `${left}%` }}
              className="absolute top-[52px] z-10 hidden size-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center text-pub-blue md:flex"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-3">
                <path d="m9 6 6 6-6 6" />
              </svg>
            </span>
          ))}
          {approach.steps.map((step, index) => (
            <div key={step.title} className="relative z-10 flex flex-col items-center text-center">
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
    <section className="mx-auto max-w-6xl px-4 py-8 sm:py-10 lg:py-12 sm:px-6">
      <SectionHeading eyebrow={aboutUs.impact.eyebrow} title={aboutUs.impact.heading} />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {home.stats.map((stat) => (
          <div
            key={stat.label}
            className="flex items-center gap-3 rounded-xl border border-pub-border bg-white p-5 shadow-sm"
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
/* Final CTA                                                               */
/* ---------------------------------------------------------------------- */

function FinalCta() {
  const { finalCta } = aboutUs;
  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:py-10 lg:py-12 sm:px-6">
      <div className="grid gap-8 rounded-2xl bg-pub-navy p-6 text-white sm:p-10 lg:grid-cols-[auto_1fr_auto] lg:items-center">
        <img
          src={aboutCtaHighfiveSrc}
          alt=""
          aria-hidden="true"
          className="hidden h-32 w-auto object-contain sm:block"
        />
        <div>
          <h2 className="font-heading text-2xl font-bold sm:text-3xl">{finalCta.heading}</h2>
          <p className="mt-2 max-w-md text-sm text-white/75 sm:text-base">{finalCta.body}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
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
