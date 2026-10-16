/**
 * Public "Contact" page (P9).
 *
 * Marketing/info page only — no auth, no portal logic. The enquiry form
 * posts to POST /api/enquiries, which mirrors the already-built
 * `enquiryRepo.create` + `contactLimiter` on the API side (see
 * apps/api/src/repositories/enquiry.repo.ts and
 * apps/api/src/middleware/rate-limit.ts) — both were staged for this page
 * and read by the existing /admin/enquiries screen. If that route isn't
 * live yet in a given environment, submission fails gracefully and falls
 * back to the always-visible email/phone/WhatsApp cards above the form.
 */

import type { ComponentType } from 'react';
import { Link } from 'react-router-dom';
import { PUBLIC_ICONS, type PublicIconKey } from '../../components/icons/public-icons.js';
import { IllustratedBadge, ContactChatArt, IllustrationGlow, DotCluster } from '../../components/illustrations/public-illustrations.js';
import { contactPage } from '../../content/site.js';
import contactHeroSupportSrc from '../../assets/illustrations/contact-hero-support.png';

type IconComp = ComponentType<{ className: string }>;

function Icon({ name, className }: { name: PublicIconKey; className: string }) {
  const Cmp = PUBLIC_ICONS[name] as IconComp;
  return <Cmp className={className} />;
}

export function ContactPage() {
  return (
    <main className="public-site overflow-x-clip">
      <Hero />
      <HelpStrip />
      <ContactCards />
      <NextStepsSection />
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
/* Hero — text + a recruitment/support visual, with quick trust chips.     */
/* ---------------------------------------------------------------------- */

function Hero() {
  const { hero } = contactPage;
  return (
    <section className="relative overflow-hidden border-b border-pub-border bg-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 right-0 h-80 w-80 rounded-full bg-pub-blue-light blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-pub-blue-light/50 blur-3xl"
      />
      <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-8 sm:px-6 sm:py-10 lg:grid-cols-2 lg:items-center lg:py-14">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-pub-blue">{hero.eyebrow}</p>
          <h1 className="mt-3 font-heading text-3xl font-extrabold leading-tight text-pub-navy sm:text-4xl lg:text-5xl">
            {hero.heading.map((part) => (
              <span key={part.text} className={part.accent ? 'block text-pub-blue' : 'block'}>
                {part.text}
              </span>
            ))}
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-pub-muted sm:text-base">{hero.body}</p>

          <ul className="mt-6 flex max-w-md flex-col gap-2.5 sm:flex-row sm:flex-wrap">
            {hero.highlights.map((item) => (
              <li
                key={item.label}
                className="flex items-center justify-start gap-2 rounded-full border border-pub-border bg-pub-bg px-3.5 py-2 text-xs font-medium text-pub-navy"
              >
                <Icon name={item.icon} className="size-4 text-pub-blue" />
                {item.label}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto flex w-full max-w-sm items-center justify-center sm:max-w-md lg:max-w-lg">
          <IllustrationGlow className="inset-x-8 inset-y-10 sm:inset-x-12 sm:inset-y-14" />
          <img
            src={contactHeroSupportSrc}
            alt=""
            aria-hidden="true"
            className="relative h-auto max-h-[28rem] w-full object-contain"
          />
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* How We Can Help — Candidates / Employers / General.                     */
/* ---------------------------------------------------------------------- */

function HelpStrip() {
  const { helpStrip } = contactPage;
  return (
    <section className="bg-pub-bg py-8 sm:py-10 lg:py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading eyebrow={helpStrip.eyebrow} title={helpStrip.heading} />
        <div className="mt-8 grid items-stretch gap-4 sm:grid-cols-3">
          {helpStrip.items.map((item) => (
            <div
              key={item.title}
              className="flex h-full flex-col items-center rounded-xl border border-pub-border bg-white p-5 text-center shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-pub-blue/40 hover:shadow-md"
            >
              <IllustratedBadge size="lg">
                <Icon name={item.icon} className="size-6" />
              </IllustratedBadge>
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
/* Contact cards — WhatsApp featured (fastest), then Phone / Email / In.   */
/* ---------------------------------------------------------------------- */

function ContactCards() {
  return (
    <section className="relative overflow-hidden px-4 py-8 sm:px-6 sm:py-10 lg:py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 right-0 h-56 w-56 rounded-full bg-pub-blue-light/40 blur-3xl"
      />
      <div className="relative mx-auto grid max-w-6xl items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {contactPage.cards.map((card) => {
          const external = card.href.startsWith('http');
          const featured = 'featured' in card && card.featured;
          return (
            <a
              key={card.label}
              href={card.href}
              target={external ? '_blank' : undefined}
              rel={external ? 'noopener noreferrer' : undefined}
              className={`relative flex h-full min-w-0 flex-col items-center gap-3 rounded-xl p-5 text-center shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg ${
                featured
                  ? 'border border-pub-navy bg-pub-navy text-white hover:shadow-pub-navy/30'
                  : 'border border-pub-border bg-white hover:border-pub-blue/40'
              }`}
            >
              {'tag' in card && card.tag && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-pub-blue px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
                  {card.tag}
                </span>
              )}
              <IllustratedBadge size="lg" {...(featured ? { className: 'ring-4 ring-white/20' } : {})}>
                <Icon name={card.icon} className="size-6" />
              </IllustratedBadge>
              <div className="min-w-0">
                <p className={`font-heading text-sm font-bold ${featured ? 'text-white' : 'text-pub-navy'}`}>
                  {card.title}
                </p>
                <p className={`mt-1 break-words text-xs leading-relaxed ${featured ? 'text-white/75' : 'text-pub-muted'}`}>
                  {card.value}
                </p>
                {'note' in card && card.note && (
                  <p className={`mt-2 text-[11px] font-medium ${featured ? 'text-white/60' : 'text-pub-muted/80'}`}>
                    {card.note}
                  </p>
                )}
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* What happens next — retained as a balanced support/process section.     */
/* ---------------------------------------------------------------------- */

function NextStepsSection() {
  const { steps } = contactPage.form;
  return (
    <section className="relative overflow-hidden bg-pub-bg py-8 sm:py-10 lg:py-10">
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 top-0 h-64 w-64 rounded-full bg-pub-blue-light/60 blur-3xl" />
      <div className="relative mx-auto grid max-w-4xl items-center gap-8 px-4 sm:px-6 md:grid-cols-[0.9fr_1.1fr]">
          <div className="relative mx-auto w-full max-w-xs">
            <IllustrationGlow className="inset-5" />
            <DotCluster className="right-0 top-0 h-12 w-14" />
            <ContactChatArt className="relative h-auto w-full" />
          </div>

          <div className="rounded-2xl border border-pub-border bg-white p-6 shadow-sm transition-all duration-200 hover:border-pub-blue/30 hover:shadow-md sm:p-8">
            <h3 className="font-heading text-sm font-bold text-pub-navy">What happens next</h3>
            <ol className="mt-4 space-y-4">
              {steps.map((step, index) => (
                <li key={step.title} className="relative flex gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-pub-blue-light text-xs font-bold text-pub-blue">
                    {index + 1}
                  </span>
                  {index < steps.length - 1 && (
                    <span aria-hidden="true" className="absolute left-[13px] top-7 bottom-[-16px] w-px bg-pub-blue/25" />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-pub-navy">{step.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-pub-muted">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* Final CTA — small, single-line, register links only.                    */
/* ---------------------------------------------------------------------- */

function FinalCta() {
  const { finalCta } = contactPage;
  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="relative flex flex-col items-center gap-4 overflow-hidden rounded-2xl bg-pub-navy p-6 text-center text-white shadow-lg sm:flex-row sm:justify-between sm:p-7 sm:text-left">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-pub-blue/30 blur-3xl" />
        <h2 className="relative font-heading text-lg font-bold sm:text-xl">{finalCta.heading}</h2>
        <div className="relative flex flex-col gap-3 sm:flex-row">
          <Link
            to={finalCta.primaryCta.to}
            className="inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-white px-5 text-sm font-semibold text-pub-navy hover:bg-pub-blue-light"
          >
            {finalCta.primaryCta.label} →
          </Link>
          <Link
            to={finalCta.secondaryCta.to}
            className="inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-white/25 px-5 text-sm font-semibold text-white hover:bg-white/10"
          >
            {finalCta.secondaryCta.label} →
          </Link>
        </div>
      </div>
    </section>
  );
}
