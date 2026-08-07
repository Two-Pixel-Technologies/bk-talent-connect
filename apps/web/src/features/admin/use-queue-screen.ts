/**
 * The state behind all three admin review queues.
 *
 * WHY THIS EXISTS
 *
 * The candidate, employer and job queues are three screens with genuinely
 * different detail panes and genuinely identical mechanics: a status filter in
 * the URL, a debounced search, a page number, a selected record, and a
 * deep-link target that may not be on the current page.
 *
 * That logic was written out three times, and every single fix to it had to be
 * made three times. Across three independent audits the same finding kept
 * appearing in the form "applied to one of three":
 *
 *   - the review panel needed keying by record, to stop a reviewer's typed
 *     rejection reason following them onto the next candidate
 *   - the search needed debouncing, or every keystroke was a request
 *   - pagination needed resetting when a filter changed
 *   - a `?focus=` deep link needed resolving against more than page one
 *
 * Each of those was a one-line fix repeated three times, which is three
 * chances to miss one — and one was missed, every time. Consolidating the
 * mechanics here means the next fix is made once and cannot be partially
 * applied. The pages keep their own detail rendering, which is the part that
 * legitimately differs.
 */

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { UseQueryResult } from '@tanstack/react-query';
import type { Page } from '@bktc/shared';
import { useDebounced } from '../../lib/use-debounced.js';

export interface QueueScreen<T> {
  /** Current status filter, read from the URL so links and reloads work. */
  readonly status: string;
  readonly setStatus: (value: string) => void;

  readonly search: string;
  readonly setSearch: (value: string) => void;

  readonly page: number;
  readonly setPage: (value: number) => void;

  readonly selectedId: string | null;
  readonly setSelectedId: (id: string | null) => void;

  /** The record being reviewed — from the list, or fetched if not in view. */
  readonly selected: T | null;

  readonly list: UseQueryResult<Page<T>>;
}

export function useQueueScreen<T extends { id: string }>(options: {
  /** Filter applied when arriving without one — the queue's daily default. */
  readonly defaultStatus: string;
  readonly useList: (status: string, search: string, page: number) => UseQueryResult<Page<T>>;
  /** Fetches one record by id. Only called when it is not on the current page. */
  readonly useDetail: (id: string | undefined) => UseQueryResult<unknown>;
  /** Pulls the record out of whatever shape the detail endpoint returns. */
  readonly selectDetail: (data: unknown) => T | undefined;
}): QueueScreen<T> {
  const [params, setParams] = useSearchParams();
  const focusId = params.get('focus');

  /*
   * A deep link points at one record whose status nobody knows, so the daily
   * default filter would usually hide it. Arriving with ?focus= widens the
   * queue to everything instead.
   */
  const status = params.get('status') ?? (focusId ? '' : options.defaultStatus);

  const [search, setSearchState] = useState('');
  // The input stays instant; only the value reaching the query is delayed.
  const debouncedSearch = useDebounced(search);

  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(focusId);

  const list = options.useList(status, debouncedSearch, page);

  const onPage = list.data?.items.find((item) => item.id === selectedId) ?? null;
  /*
   * Fetched directly when the target is not in the current page of twenty.
   * Resolving only against the page meant a notification link to any record
   * beyond row twenty landed on "Select a record to review it."
   */
  const detail = options.useDetail(selectedId && !onPage ? selectedId : undefined);
  const selected = onPage ?? options.selectDetail(detail.data) ?? null;

  return {
    status,
    setStatus: (value: string) => {
      // Page and filter move together. Staying on page 3 of a filter with one
      // page of results shows an empty list and looks like a bug.
      setPage(1);
      setParams(value ? { status: value } : {});
    },
    search,
    setSearch: (value: string) => {
      setPage(1);
      setSearchState(value);
    },
    page,
    setPage,
    selectedId,
    setSelectedId,
    selected,
    list,
  };
}
