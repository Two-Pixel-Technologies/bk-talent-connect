/**
 * Temporary landing page for P0.
 *
 * It exists to prove the whole vertical slice works end to end: the SPA builds,
 * Tailwind applies, TanStack Query runs, the Vite proxy reaches the API, and
 * the API's dependency checks report honestly. It is replaced by the real Home
 * page in P9.
 */

import { useQuery } from '@tanstack/react-query';
import type { HealthBody } from '@bktc/shared';
import { api, APP_VERSION } from '../lib/api-client.js';

export function SystemStatusPage() {
  const { data, isPending, error } = useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => api.get<HealthBody>('/health', signal),
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
      <p className="text-sm font-semibold tracking-widest text-accent-500 uppercase">
        Takai Labs
      </p>
      <h1 className="mt-2 text-4xl font-bold text-brand-900">BK Talent Connect</h1>
      <p className="mt-3 text-slate-600">
        Foundations are in place. The candidate, employer and admin portals are built next.
      </p>

      <section className="mt-10 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">
          System status
        </h2>

        {isPending && <p className="mt-4 text-slate-500">Checking…</p>}

        {error && (
          <p className="mt-4 text-accent-600">
            API unreachable. Is it running on port 4000?
          </p>
        )}

        {data && (
          <dl className="mt-4 space-y-3">
            <StatusRow label="API" ok={data.status === 'ok'} detail={data.status} />
            <StatusRow label="Database" ok={data.checks.database} />
            <StatusRow label="Uploads writable" ok={data.checks.uploadsWritable} />
            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <dt className="text-slate-600">Version</dt>
              <dd className="font-mono text-sm text-slate-500">
                client {APP_VERSION} · server {data.version}
              </dd>
            </div>
          </dl>
        )}
      </section>
    </main>
  );
}

function StatusRow({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-600">{label}</dt>
      <dd className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={`size-2.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-accent-500'}`}
        />
        <span className={ok ? 'text-emerald-700' : 'text-accent-600'}>
          {detail ?? (ok ? 'ok' : 'unavailable')}
        </span>
      </dd>
    </div>
  );
}
