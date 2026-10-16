/**
 * CANDIDATE PORTAL PROTOTYPE — job listing card.
 */

import { Link } from 'react-router-dom';
import type { MockJob } from '../mock-data.js';
import { PUBLIC_ICONS } from '../../../components/icons/public-icons.js';

function IconMapPin(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 21s-6.5-5.6-6.5-11A6.5 6.5 0 0 1 18.5 10c0 5.4-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.3" />
    </svg>
  );
}

const WORK_TYPE_LABEL: Record<MockJob['workType'], string> = {
  ONSITE: 'On-site',
  HYBRID: 'Hybrid',
  REMOTE: 'Remote',
};

export function JobCard({ job, applied }: { job: MockJob; applied: boolean }) {
  const BriefcaseIcon = PUBLIC_ICONS.briefcase;
  return (
    <div className="flex flex-col rounded-2xl border border-pub-border bg-gradient-to-br from-white to-pub-blue-light/25 p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-pub-blue/40 hover:shadow-md sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-pub-blue shadow-sm">
          <BriefcaseIcon className="size-5" />
        </span>
        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-pub-muted shadow-sm">
          {WORK_TYPE_LABEL[job.workType]}
        </span>
      </div>
      <p className="mt-3 font-heading text-sm font-bold text-pub-navy">{job.title}</p>
      <p className="mt-1 text-xs text-pub-muted">{job.sectorName}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-pub-muted">
        <span className="inline-flex items-center gap-1">
          <IconMapPin className="size-3.5" />
          {job.cityName}, {job.state}
        </span>
        <span>
          {job.minExperience}–{job.maxExperience} yrs
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {job.requiredSkills.slice(0, 3).map((skill) => (
          <span key={skill} className="rounded-full bg-pub-blue-light px-2 py-0.5 text-[10px] font-medium text-pub-blue">
            {skill}
          </span>
        ))}
      </div>
      <div className="mt-4">
        {applied ? (
          <span className="inline-flex w-full items-center justify-center rounded-lg border border-pub-border py-2 text-xs font-semibold text-pub-muted">
            Applied
          </span>
        ) : (
          <Link
            to={`/prototype/candidate/jobs/${job.id}`}
            className="flex min-h-9 w-full items-center justify-center rounded-lg bg-pub-blue text-xs font-semibold text-white hover:bg-pub-navy"
          >
            View role
          </Link>
        )}
      </div>
    </div>
  );
}
