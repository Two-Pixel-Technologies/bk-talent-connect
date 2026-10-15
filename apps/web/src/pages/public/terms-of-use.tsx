/**
 * Public Terms of Use (P9 legal page).
 *
 * Same draft-pending-legal-review status as privacy-policy.tsx — see that
 * file's header comment. Content here describes the platform's actual,
 * implemented role as an intermediary (candidate contact routed through our
 * team, company identity withheld pre-shortlist) rather than a generic
 * marketplace ToS; placeholders for jurisdiction/liability/entity details
 * are marked explicitly rather than invented.
 */

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

const LAST_REVIEWED = '15 October 2026';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-pub-border pt-6">
      <h2 className="font-heading text-lg font-bold text-pub-navy">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-pub-muted">{children}</div>
    </section>
  );
}

export function TermsOfUsePage() {
  return (
    <main className="public-site overflow-x-clip">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-xs font-semibold uppercase tracking-widest text-pub-blue">Legal</p>
        <h1 className="mt-2 font-heading text-3xl font-extrabold text-pub-navy">Terms of Use</h1>
        <p className="mt-2 text-sm text-pub-muted">Last reviewed: {LAST_REVIEWED}</p>

        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Draft — pending legal review</p>
          <p className="mt-1">
            These terms have not yet been reviewed or approved by BK Talent Acquisition and
            Advisory's legal counsel. Governing law, jurisdiction, liability limits, and formal
            entity details are placeholders below, pending that review — do not treat this page as
            finalised until it is confirmed.
          </p>
        </div>

        <div className="mt-8 space-y-6">
          <Section title="Who these terms apply to">
            <p>
              These terms apply to anyone using BK Talent Connect, operated by BK Talent Acquisition
              and Advisory, as a candidate or as an employer. By registering an account, you agree to
              use the platform as described here.
            </p>
          </Section>

          <Section title="Our role as an intermediary">
            <p>
              BK Talent Connect is a managed, advisory-led platform, not an open job board. Our team
              reviews every candidate profile, employer account, and job posting before it goes live,
              and we actively manage the hiring pipeline between candidates and employers.
            </p>
            <p>
              A candidate's direct contact details (email, mobile number) are not shared with
              employers through the platform, and a job's employer is not revealed to a candidate
              until they are shortlisted for that role. Communication about a specific application is
              routed through our team rather than conducted directly between candidate and employer
              inside the product.
            </p>
          </Section>

          <Section title="Acceptable use">
            <p>You agree to:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Provide accurate information in your profile, company account, and job postings.</li>
              <li>Use the platform only for genuine recruitment activity — seeking or offering employment through BK Talent Connect.</li>
              <li>Not attempt to access another user's account, data, or files you have not been granted access to.</li>
              <li>Not use the platform to collect candidate or employer contact details for purposes outside the hiring process we are facilitating.</li>
            </ul>
          </Section>

          <Section title="Limitations on direct contact">
            <p>
              Because candidate and employer contact details are intentionally not exchanged directly
              through the platform, candidates and employers should not attempt to circumvent this by
              soliciting contact information outside the normal course of a BK-managed hiring process.
              Our team facilitates introductions, interview scheduling, and offer communication as
              part of the service.
            </p>
          </Section>

          <Section title="Accounts and approval">
            <p>
              Candidate profiles and employer accounts are reviewed by our team before certain
              platform features (browsing jobs, posting a job) become available. We may decline to
              approve an account or posting, or may suspend an account, at our discretion where we
              believe these terms or applicable law have been violated.
            </p>
          </Section>

          <Section title="Data and privacy">
            <p>
              How we collect, use, and protect your data — and how to request its deletion — is
              described in our{' '}
              <Link to="/privacy-policy" className="font-medium text-pub-blue hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </Section>

          <Section title="Liability and disclaimers">
            <p className="italic">
              Formal liability limitations, warranty disclaimers, indemnification terms, and dispute
              resolution process: [pending — to be drafted with BK Talent Acquisition and Advisory's
              legal counsel].
            </p>
          </Section>

          <Section title="Governing law">
            <p className="italic">Governing law and jurisdiction: [pending legal review].</p>
          </Section>

          <Section title="Changes to these terms">
            <p>
              We may update these terms from time to time as the platform evolves. Material changes
              will be reflected in the "Last reviewed" date above.
            </p>
          </Section>

          <Section title="Contact us">
            <p>
              Questions about these terms can be sent through our{' '}
              <Link to="/contact" className="font-medium text-pub-blue hover:underline">
                Contact page
              </Link>
              .
            </p>
          </Section>
        </div>
      </div>
    </main>
  );
}
