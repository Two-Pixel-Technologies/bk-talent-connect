/**
 * Live build progress at /status.
 *
 * Exists so "what is done and what is pending" is answerable by opening the app
 * rather than reading a document.
 */

import { BUILD_PHASES, OPEN_QUESTIONS, type Phase } from '@bktc/shared';

const STATE_STYLES: Record<Phase['state'], { dot: string; text: string; label: string }> = {
  done: { dot: 'bg-emerald-500', text: 'text-emerald-700', label: 'Done' },
  in_progress: { dot: 'bg-amber-500 animate-pulse', text: 'text-amber-700', label: 'In progress' },
  pending: { dot: 'bg-slate-300', text: 'text-slate-400', label: 'Pending' },
};

export function BuildStatusPage() {
  const totalDays = BUILD_PHASES.reduce((sum, p) => sum + p.estimateDays, 0);
  const doneDays = BUILD_PHASES.filter((p) => p.state === 'done').reduce(
    (sum, p) => sum + p.estimateDays,
    0,
  );
  const allChecks = BUILD_PHASES.flatMap((p) => p.checks);
  const doneChecks = allChecks.filter((c) => c.done).length;
  const percent = Math.round((doneDays / totalDays) * 100);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header>
        <p className="text-sm font-semibold tracking-widest text-accent-500 uppercase">
          Phase 1 build
        </p>
        <h1 className="mt-2 text-3xl font-bold text-brand-900">BK Talent Connect</h1>
        <p className="mt-2 text-slate-600">
          {doneDays} of {totalDays} estimated days complete · {doneChecks} of {allChecks.length}{' '}
          exit checks verified
        </p>

        <div
          className="mt-5 h-2.5 w-full overflow-hidden rounded-full bg-slate-200"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Phase 1 progress"
        >
          <div
            className="h-full rounded-full bg-brand-600 transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </header>

      <ol className="mt-10 space-y-3">
        {BUILD_PHASES.map((phase) => (
          <PhaseCard key={phase.id} phase={phase} />
        ))}
      </ol>

      <section className="mt-12 rounded-xl border border-amber-200 bg-amber-50 p-6">
        <h2 className="font-semibold text-amber-900">Open questions for BK</h2>
        <p className="mt-1 text-sm text-amber-800">
          Commercial rather than technical, but the first one blocks droplet provisioning.
        </p>
        <ul className="mt-4 space-y-2">
          {OPEN_QUESTIONS.map((q) => (
            <li key={q} className="flex gap-3 text-sm text-amber-900">
              <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-500" />
              <span>{q}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function PhaseCard({ phase }: { phase: Phase }) {
  const style = STATE_STYLES[phase.state];
  const doneCount = phase.checks.filter((c) => c.done).length;
  const isOpen = phase.state !== 'pending';

  return (
    <li className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <details open={isOpen}>
        <summary className="flex cursor-pointer list-none items-center gap-4 p-4 hover:bg-slate-50">
          <span aria-hidden="true" className={`size-3 shrink-0 rounded-full ${style.dot}`} />
          <span className="font-mono text-sm text-slate-400">{phase.id}</span>
          <span className="flex-1 font-medium text-brand-900">{phase.name}</span>
          <span className="hidden text-sm text-slate-400 sm:inline">{phase.estimateDays}d</span>
          <span className={`text-sm font-medium ${style.text}`}>
            {style.label}
            {phase.state !== 'pending' && ` · ${doneCount}/${phase.checks.length}`}
          </span>
        </summary>

        <div className="border-t border-slate-100 px-4 pt-3 pb-4 pl-11">
          <p className="text-sm text-slate-600">{phase.summary}</p>
          <ul className="mt-3 space-y-1.5">
            {phase.checks.map((check) => (
              <li key={check.label} className="flex items-start gap-2.5 text-sm">
                <span
                  aria-hidden="true"
                  className={`mt-0.5 shrink-0 ${check.done ? 'text-emerald-600' : 'text-slate-300'}`}
                >
                  {check.done ? '✓' : '○'}
                </span>
                <span className={check.done ? 'text-slate-700' : 'text-slate-400'}>
                  {check.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </details>
    </li>
  );
}
