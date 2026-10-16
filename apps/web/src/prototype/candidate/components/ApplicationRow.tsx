/**
 * CANDIDATE PORTAL PROTOTYPE — application list row/card.
 */

import { Link } from 'react-router-dom';
import type { MockApplication } from '../mock-data.js';
import { StageChip } from './ui.js';
import { StageProgress } from './Timeline.js';

export function ApplicationRow({ application }: { application: MockApplication }) {
  return (
    <Link
      to={`/prototype/candidate/applications/${application.id}`}
      className="block rounded-2xl border border-pub-border bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-pub-blue/40 hover:shadow-md sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-heading text-sm font-bold text-pub-navy">{application.job.title}</p>
          <p className="mt-0.5 text-xs text-pub-muted">
            {application.job.cityName} · Applied {application.appliedAt}
          </p>
        </div>
        <StageChip stage={application.stage} />
      </div>
      <div className="mt-3">
        <StageProgress stage={application.stage} />
      </div>
      {application.interview && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-pub-blue-light px-3 py-2 text-xs font-medium text-pub-navy">
          Interview {application.interview.date}, {application.interview.time} · {application.interview.mode}
        </div>
      )}
    </Link>
  );
}
