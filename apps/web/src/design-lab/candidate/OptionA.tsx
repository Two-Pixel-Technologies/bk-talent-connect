/**
 * DESIGN LAB — Candidate Dashboard, OPTION A: Clean, premium, professional.
 *
 * A classic two-column dashboard: a calm main column (jobs + applications)
 * next to a status/actions sidebar. Minimal color, generous whitespace,
 * card language borrowed directly from the public site (rounded-2xl,
 * border-pub-border, shadow-sm). Not wired to any API — mock data only.
 */

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
  ProfileCompletionRing,
  StageBadge,
  StageTimeline,
} from './shared.js';

function StatTile({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-pub-border bg-white p-4 shadow-sm">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-pub-blue-light text-pub-blue">
        {icon}
      </span>
      <div>
        <p className="font-heading text-xl font-bold text-pub-navy">{value}</p>
        <p className="text-xs text-pub-muted">{label}</p>
      </div>
    </div>
  );
}

function JobRow({ job }: { job: (typeof mockJobs)[number] }) {
  return (
    <div className="flex flex-col gap-3 border-b border-pub-border py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-heading text-sm font-bold text-pub-navy">{job.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-pub-muted">
          <span className="inline-flex items-center gap-1">
            <IconMapPin className="size-3.5" />
            {job.cityName}, {job.state}
          </span>
          <span>{job.functionName}</span>
          <span>
            {job.minExperience}–{job.maxExperience} yrs
          </span>
        </div>
      </div>
      {job.hasApplied ? (
        <span className="shrink-0 rounded-lg border border-pub-border px-3 py-2 text-center text-xs font-semibold text-pub-muted">
          Applied
        </span>
      ) : (
        <button className="inline-flex shrink-0 min-h-9 items-center justify-center gap-1.5 rounded-lg bg-pub-blue px-4 text-xs font-semibold text-white hover:bg-pub-navy">
          View role <IconArrowRight className="size-3.5" />
        </button>
      )}
    </div>
  );
}

function ApplicationRow({ app }: { app: (typeof mockApplications)[number] }) {
  return (
    <div className="border-b border-pub-border py-4 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-heading text-sm font-bold text-pub-navy">{app.jobTitle}</p>
          <p className="mt-0.5 text-xs text-pub-muted">
            {app.cityName} · Applied {app.appliedAt}
          </p>
        </div>
        <StageBadge stage={app.stage} />
      </div>
      <div className="mt-3">
        <StageTimeline stage={app.stage} />
      </div>
      {app.interview && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-pub-blue-light px-3 py-2 text-xs font-medium text-pub-navy">
          <IconCalendar className="size-4 text-pub-blue" />
          Interview {app.interview.date}, {app.interview.time} · {app.interview.mode}
        </div>
      )}
    </div>
  );
}

export function OptionA() {
  return (
    <main className="min-h-screen bg-pub-bg">
      {/* Top bar mimics the real PortalLayout header closely enough to read as "logged in", without copying it verbatim. */}
      <header className="border-b border-pub-border bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-pub-navy font-heading text-sm font-bold text-white">
              BK
            </span>
            <span className="font-heading text-sm font-bold text-pub-navy">BK Talent Connect</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="relative text-pub-navy">
              <IconBell className="size-5" />
              {mockStats.unreadNotifications > 0 && (
                <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-pub-blue text-[9px] font-bold text-white">
                  {mockStats.unreadNotifications}
                </span>
              )}
            </span>
            <span className="hidden text-sm text-pub-muted sm:inline">{mockCandidate.fullName}</span>
            <span className="flex size-8 items-center justify-center rounded-full bg-pub-blue-light text-xs font-bold text-pub-blue">
              AV
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <h1 className="font-heading text-2xl font-bold text-pub-navy">Welcome back, {mockCandidate.fullName.split(' ')[0]}</h1>
        <p className="mt-1 text-sm text-pub-muted">Here's what's happening with your job search.</p>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Active applications" value={mockStats.activeApplications} icon={<IconBriefcase className="size-5" />} />
          <StatTile label="Shortlisted+" value={mockStats.shortlistedOrLater} icon={<IconCheckShield className="size-5" />} />
          <StatTile label="Interviews" value={mockStats.interviews} icon={<IconCalendar className="size-5" />} />
          <StatTile label="Profile complete" value={`${mockCandidate.completionPercent}%`} icon={<IconClock className="size-5" />} />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
          {/* Main column */}
          <div className="space-y-6">
            <section className="rounded-2xl border border-pub-border bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-base font-bold text-pub-navy">Recommended for you</h2>
                <a href="#" className="text-xs font-semibold text-pub-blue hover:underline">
                  Browse all jobs →
                </a>
              </div>
              <div className="mt-2">
                {mockJobs.map((job) => (
                  <JobRow key={job.id} job={job} />
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-pub-border bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-base font-bold text-pub-navy">Your applications</h2>
                <a href="#" className="text-xs font-semibold text-pub-blue hover:underline">
                  View all →
                </a>
              </div>
              <div className="mt-2">
                {mockApplications.map((app) => (
                  <ApplicationRow key={app.id} app={app} />
                ))}
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <section className="rounded-2xl border border-pub-border bg-white p-5 shadow-sm">
              <div className="flex items-center gap-4">
                <ProfileCompletionRing percent={mockCandidate.completionPercent} />
                <div>
                  <p className="font-heading text-sm font-bold text-pub-navy">Profile status</p>
                  <span className="mt-1 inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                    Approved
                  </span>
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-pub-muted">
                {mockCandidate.currentJobTitle} at {mockCandidate.currentEmployer} · {mockCandidate.cityName}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {mockCandidate.skills.slice(0, 4).map((skill) => (
                  <span key={skill.id} className="rounded-full bg-pub-blue-light px-2.5 py-1 text-[11px] font-medium text-pub-blue">
                    {skill.name}
                  </span>
                ))}
              </div>
              <button className="mt-4 flex min-h-10 w-full items-center justify-center rounded-lg border border-pub-border text-xs font-semibold text-pub-navy hover:bg-pub-bg">
                Complete your profile
              </button>
            </section>

            <section className="rounded-2xl border border-pub-border bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-sm font-bold text-pub-navy">Recent updates</h2>
                {mockStats.unreadNotifications > 0 && (
                  <span className="rounded-full bg-pub-blue px-2 py-0.5 text-[10px] font-bold text-white">
                    {mockStats.unreadNotifications} new
                  </span>
                )}
              </div>
              <ul className="mt-3 space-y-3">
                {mockNotifications.map((n) => (
                  <li key={n.id} className="flex gap-2.5">
                    <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${n.read ? 'bg-pub-border' : 'bg-pub-blue'}`} />
                    <div>
                      <p className="text-xs font-semibold text-pub-navy">{n.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-pub-muted">{n.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-2xl bg-pub-navy p-5 text-white shadow-sm">
              <h2 className="font-heading text-sm font-bold">Quick actions</h2>
              <div className="mt-3 space-y-2">
                <button className="flex min-h-10 w-full items-center justify-between rounded-lg bg-white/10 px-3 text-xs font-semibold hover:bg-white/15">
                  Browse jobs <IconArrowRight className="size-3.5" />
                </button>
                <button className="flex min-h-10 w-full items-center justify-between rounded-lg bg-white/10 px-3 text-xs font-semibold hover:bg-white/15">
                  View applications <IconArrowRight className="size-3.5" />
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
