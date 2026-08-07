/**
 * Admin overview.
 *
 * Organised around "what needs me now" rather than vanity totals — the pending
 * counts are the headline and each is a link straight into that queue.
 */

import { Link } from 'react-router-dom';
import { useStats } from '../../features/admin/use-admin.js';
import { Card } from '../../components/ui/index.js';

export function AdminDashboard() {
  const { data, isPending, error, refetch } = useStats();

  const pending = data
    ? data.candidates.pending + data.employers.pending + data.jobs.pending
    : 0;

  /*
   * `error` was never read. On a failed stats call `isPending` goes false and
   * `data` is undefined, so `pending` computed to 0 and the admin's home
   * screen opened on "Nothing is waiting for review." — a confident false
   * statement, with every count showing an em dash beneath it. Silence would
   * have been better; this was worse than blank.
   */
  const summary = isPending
    ? 'Loading…'
    : error
      ? 'We could not load your queues just now.'
      : pending === 0
        ? 'Nothing is waiting for review.'
        : `${pending} ${pending === 1 ? 'item needs' : 'items need'} your review.`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-900">Overview</h1>
        <p className="mt-1 text-sm text-slate-600">{summary}</p>
        {error && (
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-2 min-h-11 text-sm font-medium text-brand-700 hover:underline"
          >
            Try again
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <QueueCard
          to="/admin/candidates?status=SUBMITTED"
          label="Candidates awaiting review"
          value={data?.candidates.pending}
          sub={data ? `${data.candidates.approved} approved · ${data.candidates.total} total` : ''}
        />
        <QueueCard
          to="/admin/employers?status=SUBMITTED"
          label="Companies awaiting verification"
          value={data?.employers.pending}
          sub={data ? `${data.employers.approved} verified · ${data.employers.total} total` : ''}
        />
        <QueueCard
          to="/admin/jobs?status=PENDING_APPROVAL"
          label="Postings awaiting approval"
          value={data?.jobs.pending}
          sub={data ? `${data.jobs.live} live · ${data.jobs.total} total` : ''}
        />
      </div>

      {(data?.enquiries.unhandled ?? 0) > 0 && (
        <Link
          to="/admin/enquiries"
          className="block rounded-xl border border-amber-300 bg-amber-50 p-5 transition-colors hover:border-amber-400"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-amber-900">Enquiries waiting</p>
              <p className="mt-1 text-sm text-amber-800">
                Messages from the contact form that nobody has replied to yet.
              </p>
            </div>
            <p className="text-2xl font-bold text-amber-700">{data?.enquiries.unhandled}</p>
          </div>
        </Link>
      )}

      <Link
        to="/admin/pipeline"
        className="block rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-brand-300"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-brand-900">Pipeline</p>
            <p className="mt-1 text-sm text-slate-600">
              Arrange interviews and record outcomes. Employers can only shortlist — everything
              after that is yours.
            </p>
          </div>
          <p className="text-2xl font-bold text-brand-700">{data?.applications.active ?? '—'}</p>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {data ? `${data.applications.active} active of ${data.applications.total} total` : ''}
        </p>
      </Link>

      <Card>
        <h2 className="font-semibold text-brand-900">How the gates work</h2>
        <ul className="mt-4 space-y-2.5 text-sm text-slate-600">
          <li>
            A candidate sees <strong>no job listings at all</strong> until you approve their profile.
          </li>
          <li>
            A company cannot create a posting until you verify the account.
          </li>
          <li>
            A posting is invisible to candidates until you approve it — and any material edit takes
            it back offline until you approve it again.
          </li>
        </ul>
        <p className="mt-5 border-t border-slate-100 pt-4 text-sm text-slate-500">
          You are the only role that can see both a candidate&rsquo;s salary expectations and an
          employer&rsquo;s band. Neither side ever sees the other&rsquo;s.
        </p>
      </Card>
    </div>
  );
}

function QueueCard({
  to,
  label,
  value,
  sub,
}: {
  to: string;
  label: string;
  value: number | undefined;
  sub: string;
}) {
  const waiting = (value ?? 0) > 0;
  return (
    <Link
      to={to}
      className={`block rounded-xl border p-5 transition-colors ${
        waiting
          ? 'border-amber-300 bg-amber-50 hover:border-amber-400'
          : 'border-slate-200 bg-white hover:border-brand-300'
      }`}
    >
      <p className={`text-3xl font-bold ${waiting ? 'text-amber-700' : 'text-slate-400'}`}>
        {value ?? '—'}
      </p>
      <p className="mt-1 text-sm font-medium text-brand-900">{label}</p>
      <p className="mt-2 text-xs text-slate-500">{sub}</p>
    </Link>
  );
}
