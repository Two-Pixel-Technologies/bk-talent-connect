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
import { IllustratedBadge, HeroOrbitBackdrop, RecruitmentDashboardArt } from '../../components/illustrations/public-illustrations.js';
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
    <main className="overflow-x-clip">
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

/** Node order matches the arc position it is placed at, top → clockwise. */
const ORBIT_POSITIONS = [
  'left-1/2 top-0 -translate-x-1/2',
  'left-[2%] top-[22%]',
  'right-[2%] top-[22%]',
  'left-0 top-[65%]',
  'right-0 top-[65%]',
];

function OrbitNode({ icon, label, className }: { icon: PublicIconKey; label: string; className: string }) {
  return (
    <div className={`absolute z-10 flex w-28 flex-col items-center gap-2.5 text-center ${className}`}>
      <IllustratedBadge size="lg">
        <Icon name={icon} className="size-6" />
      </IllustratedBadge>
      <span className="text-[11px] font-semibold leading-tight text-pub-navy">{label}</span>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-pub-border bg-white">
      <div className="relative mx-auto max-w-5xl px-4 pb-14 pt-12 sm:px-6 sm:pt-16">
        {/* Desktop: full illustrated orbit. Smaller screens fall back to a plain chip grid below. */}
        <div className="relative mx-auto hidden h-[26rem] max-w-4xl lg:block">
          <HeroOrbitBackdrop />
          {home.hero.chips.map((chip, index) => (
            <OrbitNode key={chip.label} icon={chip.icon} label={chip.label} className={ORBIT_POSITIONS[index]!} />
          ))}
        </div>

        <div className="relative z-10 mx-auto max-w-2xl text-center lg:-mt-52">
          <p className="text-xs font-semibold uppercase tracking-widest text-pub-blue">{home.hero.eyebrow}</p>
          <h1 className="mt-4 font-heading text-3xl font-extrabold leading-tight text-pub-navy sm:text-4xl lg:text-5xl">
            {home.hero.heading.map((part) => (
              <span key={part.text} className={part.accent ? 'text-pub-blue' : undefined}>
                {part.text}{' '}
              </span>
            ))}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-pub-muted sm:text-lg">{home.hero.body}</p>

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
          {home.hero.chips.map((chip) => (
            <div
              key={chip.label}
              className="flex flex-col items-center gap-2 rounded-xl border border-pub-border bg-pub-bg px-3 py-4 text-center"
            >
              <IllustratedBadge size="md">
                <Icon name={chip.icon} className="size-4" />
              </IllustratedBadge>
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
    <section className="bg-pub-navy">
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-y-8 px-4 py-10 sm:px-6 md:grid-cols-4 md:gap-y-0">
        {home.stats.map((stat, index) => (
          <div
            key={stat.label}
            className={`flex flex-col items-center gap-2 text-center md:border-white/15 ${
              index > 0 ? 'md:border-l' : ''
            }`}
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-white/10 text-white">
              <Icon name={stat.icon} className="size-5" />
            </span>
            <p className="font-heading text-xl font-bold text-white sm:text-2xl">{stat.value}</p>
            <p className="text-xs text-white/70 sm:text-sm">{stat.label}</p>
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
    <section className="mx-auto max-w-6xl px-4 py-10 sm:py-14 lg:py-16 sm:px-6">
      <SectionHeading eyebrow="Who We Serve" />
      <div className="mt-8 grid gap-6 md:grid-cols-2">
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
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* How It Works                                                            */
/* ---------------------------------------------------------------------- */

function StepRow({
  title,
  subtitle,
  steps,
}: {
  title: string;
  subtitle: string;
  steps: readonly { title: string; body: string; icon: PublicIconKey }[];
}) {
  return (
    <div className="grid gap-6 rounded-2xl border border-pub-border bg-white p-6 sm:p-7 md:grid-cols-[200px_1fr] md:items-center">
      <div className="rounded-xl bg-pub-navy p-5 text-white">
        <h3 className="font-heading text-base font-bold">{title}</h3>
        <p className="mt-1.5 text-sm text-white/75">{subtitle}</p>
      </div>

      <div className="relative grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4">
        <div
          aria-hidden="true"
          className="absolute inset-x-8 top-7 hidden border-t-2 border-dashed border-pub-blue/30 sm:block"
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
          <div key={step.title} className="relative z-10 flex flex-col items-center text-center sm:items-start sm:text-left">
            <IllustratedBadge size="lg">
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
    <section id="how-it-works" className="scroll-mt-20 bg-pub-bg py-10 sm:py-14 lg:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading eyebrow="How It Works" />
        <div className="mt-8 space-y-5">
          <StepRow
            title={home.howItWorksCandidate.title}
            subtitle={home.howItWorksCandidate.subtitle}
            steps={home.howItWorksCandidate.steps}
          />
          <StepRow
            title={home.howItWorksEmployer.title}
            subtitle={home.howItWorksEmployer.subtitle}
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
    <section className="mx-auto max-w-6xl px-4 py-10 sm:py-14 lg:py-16 sm:px-6">
      <SectionHeading eyebrow="Why BK Talent Connect" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {home.whyUs.map((item) => (
          <div key={item.title} className="rounded-xl border border-pub-border bg-white p-5 text-center transition-all duration-200 hover:-translate-y-1 hover:border-pub-blue/40 hover:shadow-md">
            <IllustratedBadge size="lg" className="mx-auto">
              <Icon name={item.icon} className="size-6" />
            </IllustratedBadge>
            <h3 className="mt-3 font-heading text-sm font-bold text-pub-navy">{item.title}</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-pub-muted">{item.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* Industries                                                              */
/* ---------------------------------------------------------------------- */

function Industries() {
  return (
    <section id="industries" className="scroll-mt-20 bg-white py-10 sm:py-14 lg:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading eyebrow="Industries We Serve" />
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-6 rounded-2xl border border-pub-border bg-white p-6 sm:grid-cols-3 sm:p-8 lg:grid-cols-6">
          {home.industries.map((industry) => (
            <div key={industry.name} className="flex flex-col items-center gap-2.5 text-center">
              <span className="flex size-11 items-center justify-center rounded-lg bg-pub-bg text-pub-navy">
                <Icon name={industry.icon} className="size-5" />
              </span>
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
    <section className="mx-auto max-w-6xl px-4 py-10 sm:py-14 lg:py-16 sm:px-6">
      <div className="grid gap-10 rounded-2xl bg-pub-blue-light p-6 sm:p-10 lg:grid-cols-2 lg:items-center">
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
    <section id="contact" className="scroll-mt-20 bg-white py-10 sm:py-14 lg:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-8 rounded-2xl bg-pub-navy p-6 text-white sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
          <h2 className="font-heading text-xl font-bold sm:text-2xl">{contact.heading}</h2>
          <div className="grid gap-3 sm:grid-cols-3 lg:w-[38rem]">
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
  return (
    <a
      href={href}
      aria-disabled={isPlaceholder || undefined}
      onClick={isPlaceholder ? (event) => event.preventDefault() : undefined}
      className={`flex min-w-0 items-start gap-2.5 rounded-xl border border-white/15 bg-white/5 p-3 text-sm ${
        isPlaceholder ? 'cursor-default opacity-70' : 'hover:bg-white/10'
      }`}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10">
        <Icon name={icon} className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <p className="font-medium text-white">{label}</p>
        <p className="mt-0.5 break-words text-xs text-white/70">{value}</p>
      </span>
    </a>
  );
}
