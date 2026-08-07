/**
 * Debouncing a search box.
 *
 * Every search input in the portal fed its value straight into a query key, so
 * each keystroke minted a new key and fired a request — typing "maintenance
 * engineer" was around twenty-one round trips. On a mid-range Android on a
 * patchy connection that is slower than not searching at all, and it is twenty
 * extra queries against a single-writer SQLite database.
 *
 * The input stays controlled and instant; only the value that reaches the
 * query is delayed.
 */

import { useEffect, useState } from 'react';

export function useDebounced<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
