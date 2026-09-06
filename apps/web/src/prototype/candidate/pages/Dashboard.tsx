import { Link } from 'react-router-dom';
import { usePrototype } from '../PrototypeContext.js';
import { mockJobs, STAGE_STEP_INDEX } from '../mock-data.js';
import { MetricTile, ProfileProgressRing, SectionCard, ApprovalChip } from '../components/ui.js';
import { JobCard } from '../components/JobCard.js';
import { ApplicationRow } from '../components/ApplicationRow.js';
import { ProfileVerifiedArt } from '../components/illustrations.js';
import { PUBLIC_ICONS } from '../../../components/icons/public-icons.js';

export function Dashboard() {
  const { candidate, applications, notifications } = usePrototype();

  const active = applications.filter((a) => a.stage !== 'WITHDRAWN' && a.stage !== 'NOT_SELECTED').length;
  const shortlistedPlus = applications.filter((a) => STAGE_STEP_INDEX[a.stage] >= 2 && a.stage !== 'WITHDRAWN').length;
  const interviews = applications.filter((a) => a.stage === 'INTERVIEW_SCHEDULED' || a.stage === 'INTERVIEWED').length;

  const appliedJobIds = new Set(applications.map((a) => a.job.id));
  const recommended = mockJobs.filter((j) => !appliedJobIds.has(j.id)).slice(0, 3);
  const recentNotifications = notifications.slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Hero — greeting + profile status, richer gradient surface. */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-pub-navy to-[#0e2a56] p-6 text-white shadow-lg sm:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-pub-blue/30 blur-3xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <ApprovalChip status={candidate.approvalStatus} />
            <h1 className="mt-3 font-heading text-2xl font-bold sm:text-3xl">Welcome back, {candidate.fullName.split(' ')[0]}</h1>
            <p className="mt-1.5 max-w-md text-sm text-white/75">
              {candidate.currentJobTitle} · {candidate.sectorName} · {candidate.cityName}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-4 rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
            <ProfileProgressRing percent={candidate.completionPercent} />
            <div>
              <p className="text-xs text-white/70">Profile complete</p>
              <Link to="/prototype/candidate/profile" className="mt-1 inline-block text-xs font-semibold text-white underline underline-offset-2">
                Complete it →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Metrics — different pattern from the hero, small stat tiles. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricTile label="Active applications" value={active} icon={<PUBLIC_ICONS.briefcase className="size-4.5" />} />
        <MetricTile label="Shortlisted+" value={shortlistedPlus} icon={<PUBLIC_ICONS.shieldCheck className="size-4.5" />} />
        <MetricTile label="Interviews" value={interviews} icon={<PUBLIC_ICONS.clock className="size-4.5" />} />
        <MetricTile label="Unread updates" value={notifications.filter((n) => !n.read).length} icon={<PUBLIC_ICONS.bell className="size-4.5" />} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <SectionCard
            title="Recommended for you"
            action={
              <Link to="/prototype/candidate/jobs" className="text-xs font-semibold text-pub-blue hover:underline">
                Browse all →
              </Link>
            }
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recommended.map((job) => (
                <JobCard key={job.id} job={job} applied={false} />
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Your applications"
            action={
              <Link to="/prototype/candidate/applications" className="text-xs font-semibold text-pub-blue hover:underline">
                View all →
              </Link>
            }
          >
            <div className="space-y-3">
              {applications.slice(0, 3).map((app) => (
                <ApplicationRow key={app.id} application={app} />
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard>
            <div className="flex items-center gap-4">
              <ProfileVerifiedArt className="h-16 w-20 shrink-0" />
              <div>
                <p className="font-heading text-sm font-bold text-pub-navy">Profile status</p>
                <ApprovalChip status={candidate.approvalStatus} className="mt-1" />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {candidate.skills.slice(0, 4).map((skill) => (
                <span key={skill.id} className="rounded-full bg-pub-blue-light px-2.5 py-1 text-[11px] font-medium text-pub-blue">
                  {skill.name}
                </span>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Recent updates"
            action={
              <Link to="/prototype/candidate/notifications" className="text-xs font-semibold text-pub-blue hover:underline">
                View all →
              </Link>
            }
          >
            <ul className="space-y-3">
              {recentNotifications.map((n) => (
                <li key={n.id}>
                  <Link to={n.linkTo ?? '/prototype/candidate/notifications'} className="flex gap-2.5">
                    <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${n.read ? 'bg-pub-border' : 'bg-pub-blue'}`} />
                    <div>
                      <p className="text-xs font-semibold text-pub-navy">{n.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-pub-muted">{n.body}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
