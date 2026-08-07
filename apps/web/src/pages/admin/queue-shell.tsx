/**
 * Layout shared by the three review queues.
 *
 * Two panes on a wide screen so a reviewer keeps their place in the list while
 * reading a record. On a phone the detail takes over the screen and a back link
 * returns to the list — a two-pane layout at 375px would give neither pane
 * enough room to be usable.
 */

import type { ReactNode } from 'react';
import { Button, EmptyState, Input } from '../../components/ui/index.js';
import { Pagination } from '../../components/pagination.js';
import { QueryState } from '../../components/query-state.js';

export type QueueFilter = { readonly value: string; readonly label: string };

export function QueueShell({
  title,
  subtitle,
  filters,
  status,
  onStatusChange,
  search,
  onSearchChange,
  searchPlaceholder,
  total,
  page,
  pageSize,
  onPageChange,
  list,
  detail,
  selected,
  onBack,
}: {
  title: string;
  subtitle: string;
  filters: readonly QueueFilter[];
  status: string;
  onStatusChange: (value: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  total: number | undefined;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  list: ReactNode;
  detail: ReactNode;
  selected: boolean;
  onBack: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className={selected ? 'hidden lg:block' : ''}>
        <h1 className="text-2xl font-bold text-brand-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
      </div>

      <div className={selected ? 'hidden lg:block' : ''}>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {filters.map((f) => (
            <button
              key={f.value || 'all'}
              type="button"
              onClick={() => onStatusChange(f.value)}
              className={`min-h-11 shrink-0 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors ${
                status === f.value
                  ? 'bg-brand-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-3">
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
          />
          {total !== undefined && (
            <span className="shrink-0 text-sm text-slate-500">{total} total</span>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className={`space-y-3 ${selected ? 'hidden lg:block' : ''}`}>
          {list}
          {total !== undefined && total > pageSize && (
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onChange={onPageChange}
              noun="record"
            />
          )}
        </div>

        <div className={selected ? '' : 'hidden lg:block'}>
          {selected ? (
            <>
              <div className="mb-3 lg:hidden">
                <Button variant="ghost" onClick={onBack}>
                  ← Back to list
                </Button>
              </div>
              {detail}
            </>
          ) : (
            <div className="hidden rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 lg:block">
              Select a record to review it.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function QueueList({
  isPending,
  error,
  onRetry,
  isEmpty,
  emptyTitle,
  emptyDescription,
  children,
}: {
  isPending: boolean;
  error?: unknown;
  onRetry?: (() => void) | undefined;
  isEmpty: boolean | undefined;
  emptyTitle: string;
  emptyDescription: string;
  children: ReactNode;
}) {
  return (
    <QueryState isPending={isPending} error={error} onRetry={onRetry}>
      {isEmpty ? <EmptyState title={emptyTitle} description={emptyDescription} /> : children}
    </QueryState>
  );
}
