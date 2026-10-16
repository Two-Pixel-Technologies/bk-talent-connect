/**
 * Erasure requests.
 *
 * Deliberately blunt: an erasure is irreversible and takes a CV off the disk,
 * so the screen asks for confirmation in words rather than presenting a button
 * that looks like every other button.
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDateTime, type Page } from '@bktc/shared';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api-client.js';
import { Alert, Badge, Button, Card, EmptyState, Field, Textarea } from '../../components/ui/index.js';
import { Pagination } from '../../components/pagination.js';
import { QueryState } from '../../components/query-state.js';
import { ADMIN_CARD } from './admin-style.js';

type AdminErasureRequest = {
  id: string;
  status: 'OPEN' | 'COMPLETED' | 'REJECTED';
  reason: string | null;
  decisionNote: string | null;
  requestedAt: string;
  handledAt: string | null;
  userEmail: string;
  userRole: string;
};

const FILTERS = [
  { value: 'OPEN', label: 'Waiting' },
  { value: 'COMPLETED', label: 'Done' },
  { value: 'REJECTED', label: 'Not actioned' },
  { value: '', label: 'All' },
];

export function ErasurePage() {
  const [status, setStatus] = useState('OPEN');
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const params = new URLSearchParams({ page: String(page) });
  if (status) params.set('status', status);

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['admin', 'erasure', status, page],
    queryFn: () => api.get<Page<AdminErasureRequest>>(`/admin/erasure-requests?${params.toString()}`),
    placeholderData: (prev) => prev,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'erasure'] });

  const execute = useMutation({
    mutationFn: (id: string) =>
      api.post<{ filesRemoved: number }>(`/admin/erasure-requests/${id}/execute`),
    onSuccess: invalidate,
  });

  const reject = useMutation({
    mutationFn: (input: { id: string; note: string }) =>
      api.post<void>(`/admin/erasure-requests/${input.id}/reject`, { note: input.note }),
    onSuccess: invalidate,
  });

  const actionError = [execute.error, reject.error].find((e) => e instanceof ApiError) as
    | ApiError
    | undefined;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-widest text-pub-blue uppercase">Erasure</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-brand-900">Erasure requests</h1>
        <p className="mt-1.5 text-sm text-slate-600">
          People asking us to delete what we hold about them. Actioning one removes their profile,
          their CV and their contact details permanently.
        </p>
      </div>

      {actionError && <Alert tone="error">{actionError.message}</Alert>}

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FILTERS.map((f) => (
          <button
            key={f.value || 'all'}
            type="button"
            onClick={() => {
              setPage(1);
              setStatus(f.value);
            }}
            className={`min-h-11 shrink-0 cursor-pointer rounded-lg border px-3 text-sm font-semibold whitespace-nowrap transition-colors ${
              status === f.value
                ? 'border-brand-600 bg-brand-600 text-white shadow-sm shadow-brand-900/10'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <QueryState isPending={isPending} error={error} onRetry={() => void refetch()}>
        {data && data.items.length === 0 ? (
          <EmptyState title="Nothing waiting" description="Erasure requests appear here." />
        ) : (
          <div className="space-y-3">
            {data?.items.map((r) => (
              <RequestCard
                key={r.id}
                request={r}
                onExecute={() => execute.mutate(r.id)}
                onReject={(note) => reject.mutate({ id: r.id, note })}
                isPending={execute.isPending || reject.isPending}
              />
            ))}
          </div>
        )}
      </QueryState>

      {data && (
        <Pagination
          page={page}
          pageSize={data.pageSize}
          total={data.total}
          onChange={setPage}
          noun="request"
        />
      )}
    </div>
  );
}

function RequestCard({
  request: r,
  onExecute,
  onReject,
  isPending,
}: {
  request: AdminErasureRequest;
  onExecute: () => void;
  onReject: (note: string) => void;
  isPending: boolean;
}) {
  const [mode, setMode] = useState<'idle' | 'confirming' | 'rejecting'>('idle');
  const [note, setNote] = useState('');
  const [typed, setTyped] = useState('');

  return (
    <Card className={ADMIN_CARD}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold break-words text-brand-900">{r.userEmail}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {r.userRole.toLowerCase()} · asked {formatDateTime(r.requestedAt)}
          </p>
        </div>
        <Badge tone={r.status === 'COMPLETED' ? 'green' : r.status === 'REJECTED' ? 'red' : 'amber'}>
          {r.status === 'COMPLETED' ? 'Done' : r.status === 'REJECTED' ? 'Not actioned' : 'Waiting'}
        </Badge>
      </div>

      {r.reason && <p className="mt-3 text-sm text-slate-700">“{r.reason}”</p>}
      {r.decisionNote && (
        <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          <span className="font-medium">We told them:</span> {r.decisionNote}
        </p>
      )}

      {r.status === 'OPEN' && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          {mode === 'idle' && (
            <div className="flex flex-wrap gap-2">
              <Button variant="danger" className="px-3 text-xs" onClick={() => setMode('confirming')}>
                Erase this account
              </Button>
              <Button variant="secondary" className="px-3 text-xs" onClick={() => setMode('rejecting')}>
                We cannot do this yet
              </Button>
            </div>
          )}

          {mode === 'confirming' && (
            <Alert tone="error" title="This cannot be undone">
              <p>
                Their profile, CV and contact details are erased and the file is removed from disk.
                Applications and the audit trail stay, without them attached.
              </p>
              <div className="mt-3">
                <Field
                  label="Type ERASE to confirm"
                  htmlFor={`confirm-${r.id}`}
                  hint="A deliberate speed bump, not a formality."
                >
                  <input
                    id={`confirm-${r.id}`}
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    className="min-h-11 w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2.5 text-base sm:text-sm"
                  />
                </Field>
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="danger"
                  disabled={typed !== 'ERASE'}
                  loading={isPending}
                  onClick={onExecute}
                >
                  Erase permanently
                </Button>
                <Button variant="secondary" onClick={() => setMode('idle')}>
                  Cancel
                </Button>
              </div>
            </Alert>
          )}

          {mode === 'rejecting' && (
            <div>
              <Field
                label="Why not?"
                htmlFor={`note-${r.id}`}
                hint="Shown to them verbatim. Required — an unexplained refusal is indefensible."
              >
                <Textarea
                  id={`note-${r.id}`}
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </Field>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Button loading={isPending} disabled={note.trim().length < 10} onClick={() => onReject(note)}>
                  Send it
                </Button>
                <Button variant="secondary" onClick={() => setMode('idle')}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
