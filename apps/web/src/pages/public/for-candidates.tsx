/**
 * Public "For Candidates" page (P9).
 *
 * Marketing/info page only — no data fetching, no backend changes. Every CTA
 * routes into flows that already exist (registration, login, the real
 * candidate job/application flow once signed in); nothing here duplicates
 * auth or application logic, and nothing here is gated behind auth.
 */

import { useState, type ComponentType } from 'react';
import { Link } from 'react-router-dom';
import { PUBLIC_ICONS, type PublicIconKey } from '../../components/icons/public-icons.js';
import { IllustratedBadge, IllustrationGlow, DotCluster } from '../../components/illustrations/public-illustrations.js';
import { home, forCandidates } from '../../content/site.js';
import candidateHeroSrc from '../../assets/illustrations/candidate-hero-transparent.png';
import candidateProfileVerificationSrc from '../../assets/illustrations/candidate-profile-verification-transparent.png';
import profileBriefcaseSrc from '../../assets/illustrations/profile-briefcase-transparent.png';

type IconComp = ComponentType<{ className: string }>;

function Icon({ name, className }: { name: PublicIconKey; className: string }) {
  const Cmp = PUBLIC_ICONS[name] as IconComp;
  return <Cmp className={className} />;
}

export function ForCandidatesPage() {
  return (
    <main className="public-site overflow-x-clip">
      <Hero />
      <Stats />
      <WhyChoose />
      <HowItWorks />
      <Benefits />
      <FinalCta />
      <FaqAndHelp />
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
  const { hero } = forCandidates;
  return (
    <section className="relative overflow-hidden border-b border-pub-border bg-white">
      {/* Layered depth behind the copy/illustration — two soft radial blobs plus a
          sparse dot cluster in the empty corner — so the hero reads as premium
          rather than flat white, without a distracting isolated curve. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 right-0 h-96 w-96 rounded-full bg-pub-blue-light blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-pub-blue-light/60 blur-3xl"
      />
      <DotCluster className="bottom-6 left-1/3 hidden h-16 w-20 lg:block" />

      <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-8 sm:px-6 sm:py-10 lg:py-16 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-pub-blue">{hero.eyebrow}</p>
          <h1 className="mt-4 font-heading text-3xl font-extrabold leading-tight text-pub-navy sm:text-4xl lg:text-5xl">
            {hero.heading.map((part) => (
              <span key={part.text} className={part.accent ? 'block text-pub-blue' : 'block'}>
                {part.text}
              </span>
            ))}
          </h1>
          <p className="mt-5 max-w-lg text-base text-pub-muted sm:text-lg">{hero.body}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to={hero.primaryCta.to}
              className="flex min-h-12 items-center justify-center rounded-lg bg-pub-blue px-6 text-sm font-semibold text-white shadow-sm shadow-pub-blue/30 hover:bg-pub-navy sm:text-base"
            >
              {hero.primaryCta.label} →
            </Link>
            <a
              href={hero.secondaryCta.to}
              className="flex min-h-12 items-center justify-center rounded-lg border border-pub-border bg-white px-6 text-sm font-semibold text-pub-navy hover:bg-pub-bg sm:text-base"
            >
              {hero.secondaryCta.label} →
            </a>
          </div>
        </div>

        {/* An organic glow (not a hard-edged box) plus sparse dots sit behind the
            illustration so it reads as integrated artwork, not a floating cutout. */}
        <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
          <IllustrationGlow className="inset-x-10 inset-y-6 sm:inset-x-14 sm:inset-y-10" />
          <DotCluster className="left-0 top-2 h-16 w-20 sm:top-6" />
          <img
            src={candidateHeroSrc}
            alt="Illustration of a candidate reviewing their verified profile"
            className="relative h-auto w-full object-contain"
          />
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* Stats — reuses Home's stats data so the two pages never disagree.       */
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
/* Why candidates choose us                                                */
/* ---------------------------------------------------------------------- */

function WhyChoose() {
  return (
    <section className="relative overflow-hidden bg-white py-8 sm:py-10 lg:py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-20 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-pub-blue-light/50 blur-3xl"
      />
      <DotCluster className="bottom-4 right-6 h-14 w-16" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading eyebrow="Why Candidates Choose Us" title="Built around your career" />
        <div className="mt-8 grid gap-8 divide-y divide-pub-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {forCandidates.whyChoose.map((item) => (
            <div key={item.title} className="flex flex-col items-center pt-8 text-center first:pt-0 sm:px-4 sm:pt-0">
              <Icon name={item.icon} className="size-9 text-pub-blue" />
              <h3 className="mt-4 font-heading text-base font-bold text-pub-navy">{item.title}</h3>
              <p className="mt-1.5 max-w-[16rem] text-sm leading-relaxed text-pub-muted">{item.body}</p>
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

function HowItWorks() {
  const steps = home.howItWorksCandidate.steps;
  return (
    <section id="how-it-works" className="scroll-mt-20 relative overflow-hidden bg-pub-bg py-8 sm:py-10 lg:py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 top-0 h-64 w-64 rounded-full bg-pub-blue-light/60 blur-3xl"
      />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading eyebrow="How It Works" title="From registration to opportunity" />

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
          {steps.map((step, index) => (
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
/* Benefits                                                                 */
/* ---------------------------------------------------------------------- */

function Benefits() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-pub-blue-light/40 via-white to-white py-8 sm:py-10 lg:py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-pub-blue-light/50 blur-3xl"
      />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading eyebrow="Why Choose Us" title="Everything you need to grow your career" />
        <div className="mt-8 grid gap-10 lg:grid-cols-2 lg:items-center">
          <div className="relative mx-auto w-full max-w-sm">
            <IllustrationGlow className="inset-6" />
            <DotCluster className="bottom-2 right-0 h-14 w-16" />
            <img
              src={candidateProfileVerificationSrc}
              alt="Illustration of a candidate profile being verified"
              className="relative h-auto w-full object-contain"
            />
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {forCandidates.benefits.map((item) => (
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
/* Final CTA                                                               */
/* ---------------------------------------------------------------------- */

function FinalCta() {
  const { finalCta } = forCandidates;
  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:py-10 lg:py-10 sm:px-6">
      <div className="relative grid gap-8 overflow-hidden rounded-2xl bg-pub-navy p-6 text-white sm:p-10 lg:grid-cols-[auto_1fr_auto] lg:items-center">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-pub-blue/30 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <img
          src={profileBriefcaseSrc}
          alt=""
          aria-hidden="true"
          className="relative hidden h-32 w-32 object-contain sm:block"
        />
        <div className="relative">
          <h2 className="font-heading text-2xl font-bold sm:text-3xl">{finalCta.heading}</h2>
          <p className="mt-2 max-w-md text-sm text-white/75 sm:text-base">{finalCta.body}</p>
        </div>
        <div className="relative flex flex-col gap-3 sm:flex-row lg:flex-col">
          <Link
            to={finalCta.primaryCta.to}
            className="flex min-h-12 items-center justify-center rounded-lg bg-pub-blue px-6 text-sm font-semibold text-white hover:bg-white hover:text-pub-navy"
          >
            {finalCta.primaryCta.label} →
          </Link>
          <a
            href={finalCta.secondaryCta.to}
            className="flex min-h-12 items-center justify-center rounded-lg border border-white/25 px-6 text-sm font-semibold text-white hover:bg-white/10"
          >
            {finalCta.secondaryCta.label} →
          </a>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* FAQ + Need Help                                                          */
/* ---------------------------------------------------------------------- */

function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  return (
    <div className="divide-y divide-pub-border rounded-2xl border border-pub-border bg-white">
      {forCandidates.faq.map((item, index) => {
        const open = openIndex === index;
        return (
          <div key={item.question}>
            <button
              type="button"
              onClick={() => setOpenIndex(open ? null : index)}
              aria-expanded={open}
              className="flex min-h-14 w-full items-center justify-between gap-3 px-5 text-left text-sm font-semibold text-pub-navy"
            >
              {item.question}
              <span aria-hidden="true" className={`text-lg text-pub-blue transition-transform ${open ? 'rotate-45' : ''}`}>
                +
              </span>
            </button>
            {open && <p className="px-5 pb-4 text-sm leading-relaxed text-pub-muted">{item.answer}</p>}
          </div>
        );
      })}
    </div>
  );
}

function FaqAndHelp() {
  const { contact } = home;
  return (
    <section className="bg-pub-bg py-8 sm:py-10 lg:py-10">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <h2 className="font-heading text-2xl font-bold text-pub-navy sm:text-3xl">Frequently Asked Questions</h2>
          <div className="mt-6">
            <FaqAccordion />
          </div>
        </div>

        <div className="flex flex-col rounded-2xl border border-pub-border bg-white p-6 transition-all duration-200 hover:-translate-y-1 hover:border-pub-blue/40 hover:shadow-md sm:p-7">
          <h3 className="font-heading text-lg font-bold text-pub-navy">Need Help?</h3>
          <p className="mt-1.5 text-sm text-pub-muted">Our support team is here to assist you at every step.</p>
          <div className="mt-5 space-y-4">
            {[contact.email, contact.whatsapp, contact.phone].map((tile) => {
              const isPlaceholder = tile.value.startsWith('[TBC');
              return (
                <a
                  key={tile.label}
                  href={tile.href}
                  aria-disabled={isPlaceholder || undefined}
                  onClick={isPlaceholder ? (event) => event.preventDefault() : undefined}
                  className={`flex min-w-0 items-start gap-3 ${isPlaceholder ? 'cursor-default' : ''}`}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-pub-blue-light text-pub-blue">
                    <Icon name={tile.icon} className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-pub-navy">{tile.label}</p>
                    <p className="break-words text-xs text-pub-muted">{tile.value}</p>
                  </span>
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
