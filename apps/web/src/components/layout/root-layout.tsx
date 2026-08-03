import { Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { onVersionSkew } from '../../lib/api-client.js';

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
