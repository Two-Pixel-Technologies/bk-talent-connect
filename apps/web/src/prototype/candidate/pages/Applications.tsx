import { useState } from 'react';
import { usePrototype } from '../PrototypeContext.js';
import { ApplicationRow } from '../components/ApplicationRow.js';
import { EmptyState } from '../components/ui.js';
import { EmptyBoxArt } from '../components/illustrations.js';
import type { ApplicationStage } from '../mock-data.js';

const FILTERS: { label: string; test: (s: ApplicationStage) => boolean }[] = [
  { label: 'All', test: () => true },
  { label: 'Active', test: (s) => s !== 'WITHDRAWN' && s !== 'NOT_SELECTED' && s !== 'OFFER_DECLINED' },
  { label: 'Interviews', test: (s) => s === 'INTERVIEW_SCHEDULED' || s === 'INTERVIEWED' },
  { label: 'Closed', test: (s) => s === 'NOT_SELECTED' || s === 'WITHDRAWN' || s === 'OFFER_DECLINED' || s === 'JOINED' },
];

export function Applications() {
  const { applications } = usePrototype();
  const [filter, setFilter] = useState(0);

  const visible = applications.filter((a) => FILTERS[filter]!.test(a.stage));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-pub-navy">Your applications</h1>
        <p className="mt-1 text-sm text-pub-muted">Track every stage from application to decision.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f, index) => (
          <button
            key={f.label}
            onClick={() => setFilter(index)}
            className={`min-h-9 rounded-lg border px-3.5 text-xs font-semibold transition-colors ${
              filter === index ? 'border-pub-blue bg-pub-blue text-white' : 'border-pub-border bg-white text-pub-navy hover:bg-pub-bg'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<EmptyBoxArt className="size-8" />}
          title="No applications in this view"
          description="Roles you apply to will show up here with their current stage."
        />
      ) : (
        <div className="space-y-3">
          {visible.map((app) => (
            <ApplicationRow key={app.id} application={app} />
          ))}
        </div>
      )}
    </div>
  );
}
