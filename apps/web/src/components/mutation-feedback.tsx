/**
 * The second half of an interaction.
 *
 * An audit found six mutations across the portal that read only `isPending` —
 * withdraw, decline, confirm-interview, close and reopen a posting. When one
 * failed, the spinner stopped, nothing changed, and nothing was said. A
 * candidate tapping "Confirm you can make it" on an interview, getting a 409,
 * and seeing no reaction will reasonably conclude it worked. Then they turn up.
 *
 * So this renders the outcome of a mutation — either outcome — and does it in
 * an `aria-live` region so it is announced rather than only drawn.
 */

import { useEffect, useState } from 'react';
import { ApiError } from '../lib/api-client.js';
import { Alert } from './ui/index.js';

export function MutationFeedback({
  error,
  isSuccess,
  successMessage,
  /** Hide the success note after a while; failures stay until dismissed. */
  autoHideMs = 4000,
}: {
  error: unknown;
  isSuccess?: boolean;
  successMessage?: string;
  autoHideMs?: number;
}) {
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (!isSuccess || !successMessage) return;
    setShowSuccess(true);
    const timer = setTimeout(() => setShowSuccess(false), autoHideMs);
    return () => clearTimeout(timer);
  }, [isSuccess, successMessage, autoHideMs]);

  if (!error && !showSuccess) return null;

  return (
    <div aria-live="polite" className="mt-3">
      {error ? (
        <Alert tone="error">
          {error instanceof ApiError
            ? error.message
            : 'That did not go through. Check your connection and try again.'}
        </Alert>
      ) : (
        <Alert tone="success">{successMessage}</Alert>
      )}
    </div>
  );
}
