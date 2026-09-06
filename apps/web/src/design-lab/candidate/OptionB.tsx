/**
 * DESIGN LAB — Candidate Dashboard, OPTION B: Visual / vector-led.
 *
 * Same functionality as Option A, composed differently: a gradient hero
 * banner carries the profile/status story, jobs and applications render as
 * richer illustrated cards instead of list rows, and a couple of the shared
 * public-site decorative primitives (soft glow, sparse dots) add depth —
 * used sparingly, not as full-page illustrations. Mock data only.
 */

import { IllustrationGlow, DotCluster } from '../../components/illustrations/public-illustrations.js';
import {
  mockApplications,
  mockCandidate,
  mockJobs,
  mockNotifications,
  mockStats,
} from './mock-data.js';
import {
  IconArrowRight,
  IconBell,
  IconBriefcase,
  IconCalendar,
  IconCheckShield,
  IconClock,
  IconMapPin,
  StageBadge,
  StageTimeline,
} from './shared.js';

function JobCard({ job }: { job: (typeof mockJobs)[number] }) {
  return (
    <div className="flex flex-col rounded-2xl border border-pub-border bg-gradient-to-br from-white to-pub-blue-light/30 p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-pub-blue/40 hover:shadow-md">
      <span className="flex size-10 items-center justify-center rounded-full bg-white text-pub-blue shadow-sm">
        <IconBriefcase className="size-5" />
      </span>
      <p className="mt-3 font-heading text-sm font-bold text-pub-navy">{job.title}</p>
      <p className="mt-1 flex items-center gap-1 text-xs text-pub-muted">
        <IconMapPin className="size-3.5" />
        {job.cityName}, {job.state}
      </p>
      <p className="mt-1 text-xs text-pub-muted">
        {job.minExperience}–{job.maxExperience} yrs · {job.functionName}
      </p>
      <div className="mt-3">
        {job.hasApplied ? (
          <span className="inline-flex rounded-lg border border-pub-border px-3 py-1.5 text-xs font-semibold text-pub-muted">Applied</span>
        ) : (
          <button className="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-pub-blue px-3 text-xs font-semibold text-white hover:bg-pub-navy">
            View role <IconArrowRight className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function ApplicationCard({ app }: { app: (typeof mockApplications)[number] }) {
  return (
    <div className="rounded-2xl border border-pub-border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="font-heading text-sm font-bold text-pub-navy">{app.jobTitle}</p>
        <StageBadge stage={app.stage} />
      </div>
      <p className="mt-1 text-xs text-pub-muted">
        {app.cityName} · Applied {app.appliedAt}
      </p>
      <div className="mt-3">
        <StageTimeline stage={app.stage} compact />
      </div>
      {app.interview && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-pub-blue-light px-3 py-2 text-xs font-medium text-pub-navy">
          <IconCalendar className="size-4 text-pub-blue" />
          {app.interview.date}, {app.interview.time}
        </div>
      )}
    </div>
  );
}

export function OptionB() {
  return (
    <main className="min-h-screen bg-pub-bg">
      <header className="border-b border-pub-border bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-pub-navy font-heading text-sm font-bold text-white">BK</span>
            <span className="font-heading text-sm font-bold text-pub-navy">BK Talent Connect</span>
          </div>
          <span className="relative text-pub-navy">
            <IconBell className="size-5" />
            {mockStats.unreadNotifications > 0 && (
              <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-pub-blue text-[9px] font-bold text-white">
                {mockStats.unreadNotifications}
              </span>
            )}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Gradient hero — the profile/status story lives here, not in a plain card. */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-pub-navy to-[#0e2a56] p-6 text-white shadow-lg sm:p-8">
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-pub-blue/30 blur-3xl" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="inline-flex rounded-full bg-emerald-400/20 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                Profile Approved
              </span>
              <h1 className="mt-3 font-heading text-2xl font-bold sm:text-3xl">Welcome back, {mockCandidate.fullName.split(' ')[0]}</h1>
              <p className="mt-1.5 max-w-md text-sm text-white/75">
                {mockCandidate.currentJobTitle} · {mockCandidate.sectorName} · {mockCandidate.cityName}
              </p>
            </div>
            <div className="relative w-full max-w-[10rem] shrink-0 sm:w-40">
              <IllustrationGlow className="inset-0 opacity-40" />
              <div className="relative rounded-2xl bg-white/10 p-4 text-center backdrop-blur-sm">
                <p className="font-heading text-3xl font-bold">{mockCandidate.completionPercent}%</p>
                <p className="mt-1 text-xs text-white/70">Profile complete</p>
                <button className="mt-3 flex min-h-8 w-full items-center justify-center rounded-lg bg-white text-xs font-semibold text-pub-navy hover:bg-pub-blue-light">
                  Finish it
                </button>
              </div>
            </div>
          </div>

          <div className="relative mt-6 grid grid-cols-3 gap-3 border-t border-white/15 pt-5">
            <div className="text-center">
              <p className="font-heading text-xl font-bold">{mockStats.activeApplications}</p>
              <p className="text-[11px] text-white/70">Active</p>
            </div>
            <div className="text-center">
              <p className="font-heading text-xl font-bold">{mockStats.shortlistedOrLater}</p>
              <p className="text-[11px] text-white/70">Shortlisted+</p>
            </div>
            <div className="text-center">
              <p className="font-heading text-xl font-bold">{mockStats.interviews}</p>
              <p className="text-[11px] text-white/70">Interviews</p>
            </div>
          </div>
        </section>

        {/* Recommended jobs — card grid, not a list. */}
        <section className="relative mt-8 overflow-hidden">
          <DotCluster className="right-0 top-0 h-14 w-16" />
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-bold text-pub-navy">Recommended for you</h2>
            <a href="#" className="text-xs font-semibold text-pub-blue hover:underline">
              Browse all →
            </a>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {mockJobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        </section>

        {/* Applications */}
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-bold text-pub-navy">Your applications</h2>
            <a href="#" className="text-xs font-semibold text-pub-blue hover:underline">
              View all →
            </a>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {mockApplications.map((app) => (
              <ApplicationCard key={app.id} app={app} />
            ))}
          </div>
        </section>

        {/* Notifications + skills, side by side on desktop */}
        <section className="mt-8 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-pub-border bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 font-heading text-sm font-bold text-pub-navy">
              <IconCheckShield className="size-4 text-pub-blue" />
              Your skills
            </h2>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {mockCandidate.skills.map((skill) => (
                <span key={skill.id} className="rounded-full bg-pub-blue-light px-2.5 py-1 text-[11px] font-medium text-pub-blue">
                  {skill.name}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-pub-border bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 font-heading text-sm font-bold text-pub-navy">
              <IconClock className="size-4 text-pub-blue" />
              Recent updates
            </h2>
            <ul className="mt-3 space-y-2.5">
              {mockNotifications.map((n) => (
                <li key={n.id} className="flex gap-2.5">
                  <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${n.read ? 'bg-pub-border' : 'bg-pub-blue'}`} />
                  <p className="text-xs leading-relaxed text-pub-muted">
                    <span className="font-semibold text-pub-navy">{n.title}.</span> {n.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}
