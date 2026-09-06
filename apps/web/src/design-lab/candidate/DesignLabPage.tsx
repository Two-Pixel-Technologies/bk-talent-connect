/**
 * DESIGN LAB — Candidate Dashboard prototypes, dev-only preview.
 *
 * Mounted at /design-lab/candidate ONLY in dev builds (see router.tsx —
 * spread into the same import.meta.env.DEV block as /status and /system,
 * so it never ships in a production bundle). Not linked from anywhere in
 * the real app; nothing here touches production routes, components, or
 * the API. Pure client-side option switcher over mock data.
 */

import { useState } from 'react';
import { OptionA } from './OptionA.js';
import { OptionB } from './OptionB.js';
import { OptionC } from './OptionC.js';

const OPTIONS = [
  { id: 'a', label: 'Option A — Clean & Premium', Component: OptionA },
  { id: 'b', label: 'Option B — Visual & Vector-led', Component: OptionB },
  { id: 'c', label: 'Option C — Compact SaaS', Component: OptionC },
] as const;

export function DesignLabPage() {
  const [active, setActive] = useState<(typeof OPTIONS)[number]['id']>('a');
  const current = OPTIONS.find((o) => o.id === active)!;

  return (
    <div>
      <div className="sticky top-0 z-30 flex flex-wrap items-center gap-2 border-b border-slate-300 bg-slate-900 px-4 py-2.5 text-white">
        <span className="mr-2 text-xs font-bold uppercase tracking-wide text-amber-400">Design Lab · Not Production</span>
        {OPTIONS.map((o) => (
          <button
            key={o.id}
            onClick={() => setActive(o.id)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              active === o.id ? 'bg-white text-slate-900' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <current.Component />
    </div>
  );
}
