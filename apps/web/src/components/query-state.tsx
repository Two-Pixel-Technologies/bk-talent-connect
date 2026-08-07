/**
 * Loading and error states for a query-backed list.
 *
 * Several pages handled `isPending` and `data` but never `isError`, so a 403 or
 * a dropped connection rendered the page heading and then nothing at all — a
 * blank dead end with no message and no way forward. On a patchy mobile
 * connection that is the most likely thing a real candidate sees.
 */

import type { ReactNode } from 'react';
import { ApiError } from '../lib/api-client.js';
import { Alert, Button } from './ui/index.js';

export function QueryState({
  isPending,
  error,
  onRetry,
  loadingLabel = 'Loading…',
  children,
}: {
  isPending: boolean;
  error: unknown;
  onRetry?: (() => void) | undefined;
  loadingLabel?: string;
  children: ReactNode;
}) {
  if (isPending) {
    return (
      <div className="space-y-3" aria-busy="true" aria-live="polite">
        <p className="text-slate-500">{loadingLabel}</p>
        {/* Skeletons rather than bare text: the layout does not jump when the
            real content arrives. */}
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl border border-slate-200 bg-slate-50" />
        ))}
      </div>
    );
  }

  if (error) {
    const apiError = error instanceof ApiError ? error : null;
    const isAuth = apiError?.status === 401;

    return (
      <Alert tone={apiError?.status === 403 ? 'warning' : 'error'} title="We couldn’t load this">
        <p>
          {apiError?.message ??
            'Something went wrong fetching this. Check your connection and try again.'}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {isAuth ? (
            <Button onClick={() => window.location.assign('/login')}>Sign in again</Button>
          ) : (
            onRetry && (
              <Button variant="secondary" onClick={onRetry}>
                Try again
              </Button>
            )
          )}
        </div>
      </Alert>
    );
  }

  return <>{children}</>;
}
