/**
 * Pagination controls.
 *
 * The API paginated correctly from the start; the client simply requested page
 * one and rendered it, while printing "45 total" above 20 rows. That looks fine
 * on demo data and breaks the week the client onboards a second batch.
 */

import { Button } from './ui/index.js';

export function Pagination({
  page,
  pageSize,
  total,
  onChange,
  noun = 'result',
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
  noun?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 pt-4 sm:flex-row"
    >
      <p className="text-sm text-slate-600">
        {total === 1 ? (
          <>1 {noun}</>
        ) : (
          <>
            Showing <span className="font-medium text-slate-800">{first}–{last}</span> of {total}{' '}
            {noun}s
          </>
        )}
      </p>

      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            className="px-3 text-sm"
            disabled={page <= 1}
            onClick={() => onChange(page - 1)}
          >
            ← Previous
          </Button>
          <span className="px-1 text-sm text-slate-500" aria-current="page">
            {page} of {totalPages}
          </span>
          <Button
            variant="secondary"
            className="px-3 text-sm"
            disabled={page >= totalPages}
            onClick={() => onChange(page + 1)}
          >
            Next →
          </Button>
        </div>
      )}
    </nav>
  );
}
