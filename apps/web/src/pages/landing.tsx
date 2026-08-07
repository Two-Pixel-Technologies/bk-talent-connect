/**
 * Landing page.
 *
 * A placeholder for the real Home page (P9), but a working front door: it routes
 * each of the three audiences to the right entry point rather than making
 * someone guess a URL. Signed-in users are sent straight to their portal.
 */

import { Link, Navigate } from 'react-router-dom';
import { useAuth, HOME_FOR_ROLE } from '../features/auth/auth-context.js';

export function LandingPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-slate-500">Loading…</div>;
  }

  // Already signed in — no reason to show a marketing page.
  if (user) return <Navigate to={HOME_FOR_ROLE[user.role]} replace />;

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-4 sm:px-6">
          <div>
            <p className="text-[10px] font-semibold tracking-widest text-accent-500 uppercase">
              Takai Labs
            </p>
            <p className="text-lg font-bold text-brand-900">BK Talent Connect</p>
          </div>
          <Link
            to="/login"
            className="flex min-h-11 shrink-0 items-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-brand-700 hover:bg-slate-50"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-10 sm:px-6 sm:py-16">
        <h1 className="max-w-2xl text-3xl font-bold text-brand-900 sm:text-4xl lg:text-5xl">
          Technical talent, matched by people who know the work.
        </h1>
        <p className="mt-4 max-w-xl text-base text-slate-600 sm:text-lg">
          A managed recruitment portal for India&rsquo;s industrial sectors — engineering, pharma,
          manufacturing and more. Every profile and every role is reviewed by our team.
        </p>

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          <EntryCard
            title="For candidates"
            body="Build one profile. Our team reviews it, then puts you in front of employers hiring for your skills — including roles that are never advertised."
            primary={{ to: '/register/candidate', label: 'Create your profile' }}
            secondary={{ to: '/login', label: 'Sign in' }}
          />
          <EntryCard
            title="For employers"
            body="Post a role with a confidential salary band. We verify every company, review every posting, and shortlist candidates ourselves before you spend time on them."
            primary={{ to: '/register/employer', label: 'Register your company' }}
            secondary={{ to: '/login', label: 'Sign in' }}
          />
        </div>

        <p className="mt-14 border-t border-slate-200 pt-6 text-sm text-slate-500">
          Public pages (About, For Candidates, For Employers, Contact, Privacy, Terms) and the
          public jobs listing are scheduled for P9 — the portal is being built first.
          {/* Gated exactly like the route it points at. Excluding /status from
              the production bundle without excluding the link to it left a 404
              on the public front door. */}
          {import.meta.env.DEV && (
            <>
              {' '}
              <Link to="/status" className="font-medium text-brand-600 hover:underline">
                See build progress →
              </Link>
            </>
          )}
        </p>
      </main>
    </div>
  );
}

function EntryCard({
  title,
  body,
  primary,
  secondary,
}: {
  title: string;
  body: string;
  primary: { to: string; label: string };
  secondary: { to: string; label: string };
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
      <h2 className="text-xl font-semibold text-brand-900">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          to={primary.to}
          className="flex min-h-11 flex-1 items-center justify-center rounded-lg bg-brand-600 px-5 text-sm font-medium text-white hover:bg-brand-700 sm:flex-initial"
        >
          {primary.label}
        </Link>
        <Link
          to={secondary.to}
          className="flex min-h-11 flex-1 items-center justify-center rounded-lg border border-slate-300 px-5 text-sm font-medium text-brand-700 hover:bg-slate-50 sm:flex-initial"
        >
          {secondary.label}
        </Link>
      </div>
    </section>
  );
}
