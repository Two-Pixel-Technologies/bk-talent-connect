import { Outlet, useLocation, useNavigationType } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { onVersionSkew } from '../../lib/api-client.js';

/**
 * Resets scroll to the top on every navigation to a new route. Skipped for
 * POP navigation (back/forward) so the browser's native scroll restoration —
 * returning to where the user was — keeps working; only PUSH/REPLACE (link
 * clicks, programmatic navigation) force a scroll-to-top.
 */
function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType !== 'POP') {
      window.scrollTo(0, 0);
    }
  }, [pathname, navigationType]);

  return null;
}

/**
 * Shell shared by every route. The version-skew banner lives here because it
 * must be reachable from any page — a user holding a bundle from before the
 * last deploy will otherwise hit 404s on lazily-loaded chunks with no
 * explanation.
 */
export function RootLayout() {
  const [staleBuild, setStaleBuild] = useState(false);

  useEffect(() => onVersionSkew(() => setStaleBuild(true)), []);

  return (
    <div className="min-h-screen">
      <ScrollToTop />
      {staleBuild && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-center gap-3 bg-accent-500 px-4 py-2 text-sm text-white"
        >
          <span>A newer version of BK Talent Connect is available.</span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded bg-white/20 px-3 py-1 font-medium hover:bg-white/30"
          >
            Reload
          </button>
        </div>
      )}
      <Outlet />
    </div>
  );
}
