/**
 * Public Privacy Policy (P9 legal page).
 *
 * Every factual statement here is drawn from what the product actually does
 * today (see apps/web/src/pages/account/privacy.tsx and the API routes/
 * serializers it describes) — nothing about AI matching or email/WhatsApp
 * delivery is claimed as live, since neither exists yet. Items that need a
 * legal/business decision (registered address, grievance officer, retention
 * periods) are explicitly marked as pending rather than invented.
 */

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-pub-border pt-6">
      <h2 className="font-heading text-lg font-bold text-pub-navy">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-pub-muted">{children}</div>
    </section>
  );
}

export function PrivacyPolicyPage() {
  return (
    <main className="public-site legal-public overflow-x-clip">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-xs font-semibold uppercase tracking-widest text-pub-blue">Legal</p>
        <h1 className="mt-2 font-heading text-3xl font-extrabold text-pub-navy">Privacy Policy</h1>

        <div className="mt-8 space-y-6">
          <Section title="Who operates this platform">
            <p>
              BK Talent Connect is a managed recruitment portal operated by BK Talent Acquisition and
              Advisory, connecting candidates and hiring companies across India's industrial sectors.
              Every candidate profile, employer account, and job posting is reviewed by our team
              before it is visible to the other side.
            </p>
            <p className="italic">
              Registered business name, address, and contact details for formal legal notices:
              [pending — to be supplied by BK Talent Acquisition and Advisory].
            </p>
          </Section>

          <Section title="What we collect">
            <p>
              <span className="font-medium text-pub-navy">From candidates:</span> name, email,
              mobile number, city and state, professional background (job title, employer, years of
              experience, sector, skills, education, career history), a career summary, notice
              period, employment preference, current and expected salary, your resume, and an
              optional LinkedIn link.
            </p>
            <p>
              <span className="font-medium text-pub-navy">From employers:</span> company name,
              sector, hiring locations, website, primary HR contact details, an optional LinkedIn
              company page, a company introduction, and job posting details including the private
              salary band for each role.
            </p>
          </Section>

          <Section title="Who sees what">
            <p>
              <span className="font-medium text-pub-navy">Employers never see</span> a candidate's
              email address, mobile number, or any salary information — current or expected. All
              contact between a candidate and an employer is routed through the BK Talent Connect
              team; employers do not receive a candidate's direct contact details through the
              platform.
            </p>
            <p>
              <span className="font-medium text-pub-navy">Candidates never see</span> the salary band
              on a job posting, and a job's company name is withheld until the candidate is
              shortlisted for that role.
            </p>
            <p>
              <span className="font-medium text-pub-navy">Our team</span> can see full candidate and
              employer profiles, including salary details, so we can review accounts and match
              candidates to roles responsibly.
            </p>
          </Section>

          <Section title="How your resume is handled">
            <p>
              Resumes are uploaded as PDF or DOCX, validated on upload, and stored securely. Access
              to a candidate's resume file is restricted to our team and to employers the candidate
              has actually applied to (or been put forward to) — not to employers generally.
            </p>
          </Section>

          <Section title="Automated matching and AI">
            <p>
              BK Talent Connect does not currently use any automated or AI-based scoring to match
              candidates to roles — all shortlisting and recommendation decisions are made manually
              by our team. If an automated matching system is introduced in future, this policy will
              be updated first to describe what it does and who can see its output.
            </p>
          </Section>

          <Section title="Cookies and sessions">
            <p>
              We use a single session cookie to keep you signed in; it is not used for advertising or
              cross-site tracking. We do not currently use third-party analytics, advertising, or
              tracking scripts on this site.
            </p>
          </Section>

          <Section title="Data deletion requests">
            <p>
              You can ask us to erase the personal data we hold about you from your account's "Your
              Data" page once you are signed in. We review each request — if you are in the middle of
              a hiring process with an employer, we will tell you before acting on the request rather
              than removing you from it without warning. Records of hiring processes you took part in
              may be retained without your personal details attached, so that we and our clients can
              account for decisions that were made.
            </p>
            <p className="italic">
              Formal data retention periods for each category of data: [pending — to be confirmed by
              BK Talent Acquisition and Advisory].
            </p>
          </Section>

          <Section title="Your rights under the DPDP Act">
            <p>
              BK Talent Connect intends to handle personal data in line with India's Digital Personal
              Data Protection Act, 2023 (DPDP Act). This includes the right to access, correct, and
              request erasure of your personal data, which you can exercise from your account as
              described above.
            </p>
            <p className="italic">
              A named grievance officer and formal grievance-redressal contact, as required under the
              DPDP Act, are [pending — to be supplied by BK Talent Acquisition and Advisory].
            </p>
          </Section>

          <Section title="Contact us">
            <p>
              Questions about this policy or your data can be sent through our{' '}
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
