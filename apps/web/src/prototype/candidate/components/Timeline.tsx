/**
 * CANDIDATE PORTAL PROTOTYPE — application progress/timeline.
 * Mirrors the real 5-step candidate-facing model (CANDIDATE_TIMELINE_STEPS /
 * STAGE_STEP_INDEX in @bktc/shared): Applied → Under Review → Shortlisted →
 * Interview → Decision.
 */

import { CANDIDATE_TIMELINE_STEPS, STAGE_STEP_INDEX, type ApplicationStage, type StageEvent } from '../mock-data.js';
import { CANDIDATE_STAGE_LABEL } from '../mock-data.js';

/** Compact horizontal progress bar — used on cards/rows. */
export function StageProgress({ stage }: { stage: ApplicationStage }) {
  const currentIndex = STAGE_STEP_INDEX[stage];
  return (
    <div className="flex items-center gap-1">
      {CANDIDATE_TIMELINE_STEPS.map((step, index) => (
        <span
          key={step}
          title={step}
          className={`h-1.5 flex-1 rounded-full ${index <= currentIndex ? 'bg-pub-blue' : 'bg-pub-border'}`}
        />
      ))}
    </div>
  );
}

/** Full step-by-step timeline with labels — used on the detail page. */
export function StageStepper({ stage }: { stage: ApplicationStage }) {
  const currentIndex = STAGE_STEP_INDEX[stage];
  const withdrawn = stage === 'WITHDRAWN';
  return (
    <div className="flex items-start">
      {CANDIDATE_TIMELINE_STEPS.map((step, index) => {
        const done = !withdrawn && index < currentIndex;
        const current = !withdrawn && index === currentIndex;
        return (
          <div key={step} className="flex flex-1 flex-col items-center text-center last:flex-none">
            <div className="flex w-full items-center">
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                  done
                    ? 'border-pub-blue bg-pub-blue text-white'
                    : current
                      ? 'border-pub-blue bg-white text-pub-blue'
                      : 'border-pub-border bg-white text-pub-muted'
                }`}
              >
                {done ? '✓' : index + 1}
              </span>
              {index < CANDIDATE_TIMELINE_STEPS.length - 1 && (
                <span className={`mx-1 h-0.5 flex-1 ${index < currentIndex ? 'bg-pub-blue' : 'bg-pub-border'}`} />
              )}
            </div>
            <span className={`mt-2 max-w-[5.5rem] text-[11px] font-semibold leading-tight ${current ? 'text-pub-navy' : 'text-pub-muted'}`}>
              {step}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

/** Chronological event log — "History" panel on the detail page. */
export function StageHistory({ history }: { history: StageEvent[] }) {
  return (
    <ol className="space-y-4">
      {history.map((event, index) => (
        <li key={index} className="flex gap-3">
          <span className="mt-1 flex size-2 shrink-0 items-center justify-center rounded-full bg-pub-blue" />
          <div>
            <p className="text-sm font-semibold text-pub-navy">{CANDIDATE_STAGE_LABEL[event.stage]}</p>
            <p className="text-xs text-pub-muted">{formatDateTime(event.at)}</p>
            {event.note && <p className="mt-1 text-xs leading-relaxed text-pub-text">{event.note}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
