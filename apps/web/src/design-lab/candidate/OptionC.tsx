/**
 * DESIGN LAB — Candidate Dashboard, OPTION C: Compact SaaS workspace.
 *
 * Same functionality as A/B, composed for information density: a slim icon
 * nav rail, a tight KPI strip, and dense table-style rows instead of big
 * cards. Smaller type, tighter spacing — reads like Linear/Notion rather
 * than a marketing-adjacent dashboard. Mock data only.
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
  IconUser,
  StageBadge,
  StageTimeline,
} from './shared.js';

const NAV = [
  { label: 'Overview', icon: IconClock, active: true },
  { label: 'Profile', icon: IconUser, active: false },
  { label: 'Jobs', icon: IconBriefcase, active: false },
  { label: 'Applications', icon: IconCheckShield, active: false },
];

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border-r border-pub-border px-4 py-3 last:border-0">
      <p className="font-heading text-lg font-bold text-pub-navy">{value}</p>
      <p className="text-[11px] text-pub-muted">{label}</p>
    </div>
  );
}

export function OptionC() {
  return (
    <main className="flex min-h-screen bg-white text-sm">
      {/* Slim icon nav rail — desktop/tablet only; mobile gets a bottom tab bar instead (see below). */}
      <nav className="hidden w-16 shrink-0 flex-col items-center gap-1 border-r border-pub-border bg-pub-bg py-4 sm:flex">
        <span className="mb-3 flex size-9 items-center justify-center rounded-lg bg-pub-navy font-heading text-xs font-bold text-white">
          BK
        </span>
        {NAV.map((item) => (
          <button
            key={item.label}
            title={item.label}
            className={`flex size-10 items-center justify-center rounded-lg ${
              item.active ? 'bg-pub-blue text-white' : 'text-pub-muted hover:bg-pub-blue-light hover:text-pub-blue'
            }`}
          >
            <item.icon className="size-5" />
          </button>
        ))}
      </nav>

      <div className="flex-1 pb-16 sm:pb-0">
        {/* Compact top bar */}
        <div className="flex items-center justify-between border-b border-pub-border px-4 py-2.5 sm:px-6">
          <div>
            <p className="font-heading text-sm font-bold text-pub-navy">Overview</p>
            <p className="text-xs text-pub-muted">{mockCandidate.fullName} · {mockCandidate.currentJobTitle}</p>
          </div>
          <span className="relative text-pub-navy">
            <IconBell className="size-4.5" />
            {mockStats.unreadNotifications > 0 && (
              <span className="absolute -right-1 -top-1 flex size-3.5 items-center justify-center rounded-full bg-pub-blue text-[8px] font-bold text-white">
                {mockStats.unreadNotifications}
              </span>
            )}
          </span>
        </div>

        {/* KPI strip */}
        <div className="flex flex-wrap divide-x divide-pub-border border-b border-pub-border sm:flex-nowrap">
          <Kpi label="Profile complete" value={`${mockCandidate.completionPercent}%`} />
          <Kpi label="Active applications" value={mockStats.activeApplications} />
          <Kpi label="Shortlisted+" value={mockStats.shortlistedOrLater} />
          <Kpi label="Interviews" value={mockStats.interviews} />
        </div>

        <div className="grid grid-cols-1 gap-0 lg:grid-cols-[1fr_18rem]">
          {/* Dense application rows */}
          <div className="border-b border-pub-border lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between px-4 py-2.5 sm:px-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-pub-muted">Applications</p>
              <a href="#" className="text-xs font-semibold text-pub-blue hover:underline">
                View all
              </a>
            </div>
            <div>
              {mockApplications.map((app) => (
                <div key={app.id} className="flex flex-col gap-2 border-t border-pub-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div className="min-w-0 sm:w-48">
                    <p className="truncate text-sm font-semibold text-pub-navy">{app.jobTitle}</p>
                    <p className="text-[11px] text-pub-muted">{app.cityName} · {app.appliedAt}</p>
                  </div>
                  <div className="flex-1 sm:px-4">
                    <StageTimeline stage={app.stage} compact />
                  </div>
                  <StageBadge stage={app.stage} className="w-fit" />
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-pub-border px-4 py-2.5 sm:px-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-pub-muted">Recommended jobs</p>
              <a href="#" className="text-xs font-semibold text-pub-blue hover:underline">
                Browse all
              </a>
            </div>
            <div>
              {mockJobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between gap-3 border-t border-pub-border px-4 py-2.5 sm:px-6">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-pub-navy">{job.title}</p>
                    <p className="text-[11px] text-pub-muted">
                      {job.cityName} · {job.minExperience}–{job.maxExperience} yrs
                    </p>
                  </div>
                  {job.hasApplied ? (
                    <span className="shrink-0 text-[11px] font-semibold text-pub-muted">Applied</span>
                  ) : (
                    <button className="flex shrink-0 items-center gap-1 text-xs font-semibold text-pub-blue hover:underline">
                      View <IconArrowRight className="size-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Compact side rail: skills + activity feed */}
          <div className="px-4 py-4 sm:px-6 lg:py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-pub-muted">Skills</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {mockCandidate.skills.map((skill) => (
                <span key={skill.id} className="rounded bg-pub-blue-light px-2 py-0.5 text-[11px] font-medium text-pub-blue">
                  {skill.name}
                </span>
              ))}
            </div>

            <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-pub-muted">Activity</p>
            <ul className="mt-2 space-y-2.5">
              {mockNotifications.map((n) => (
                <li key={n.id} className="flex gap-2 text-xs">
                  <IconCalendar className="mt-0.5 size-3.5 shrink-0 text-pub-muted" />
                  <div>
                    <p className="font-medium text-pub-navy">{n.title}</p>
                    <p className="text-pub-muted">{n.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Mobile-only bottom tab bar — replaces the icon rail rather than shrinking it. */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-around border-t border-pub-border bg-white py-1.5 sm:hidden">
        {NAV.map((item) => (
          <button key={item.label} className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] ${item.active ? 'text-pub-blue' : 'text-pub-muted'}`}>
            <item.icon className="size-5" />
            {item.label}
          </button>
        ))}
      </nav>
    </main>
  );
}
