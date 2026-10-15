/**
 * Admin Portal shell — a sidebar layout, not the public-navbar-style header
 * Candidate/Employer use.
 *
 * Ten nav items in one horizontal row (the old shared-header approach) had
 * nowhere good to go: cramped at 1280, scrolling out of reach at 1024, and the
 * logo's flexible wordmark and the nav's own `ml-auto` were fighting for the
 * same leftover space in the flex row, which is what collapsed the wordmark
 * and crowded the badge against "Overview". A vertical sidebar sidesteps the
 * problem entirely — ten items read as a list, not a squeeze — and it is
 * built as its own component (not a PortalLayout variant) precisely so
 * Candidate and Employer, whose short navs never had this problem, are not
 * touched by the fix.
 *
 * The sidebar is navigation and branding only. Account access (email, sign
 * out) lives in the top header instead, next to the notification bell — the
 * same corner Candidate/Employer keep it in — rather than at the bottom of
 * the sidebar, which read as a second, disconnected settings area.
 */

import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api-client.js';
import { useAuth } from '../../features/auth/auth-context.js';
import { NotificationBell } from '../notification-bell.js';

type AdminNavItem = { readonly to: string; readonly label: string; readonly end?: boolean };
type AdminNavGroup = { readonly label: string; readonly items: readonly AdminNavItem[] };

/**
 * Interviews and Skills were removed deliberately, not just relabelled:
 *
 * - Interviews: interview coordination is a Candidate/Employer responsibility
 *   now, not Admin's — see admin-coordination.routes.ts's file comment.
 *   Read-only interview status is folded into the Pipeline page instead.
 * - Skills: its page and routes still exist (the free-text-skill approve/
 *   merge workflow has no other UI), just unlinked from this nav per the
 *   requested scope — reachable directly at /admin/skills. See the final
 *   report for why removing the page itself would orphan that workflow.
 */
const NAV_GROUPS: readonly AdminNavGroup[] = [
  {
    label: 'Operations',
    items: [
      { to: '/admin', label: 'Overview', end: true },
      { to: '/admin/candidates', label: 'Candidates' },
      { to: '/admin/employers', label: 'Employers' },
      { to: '/admin/jobs', label: 'Jobs' },
      { to: '/admin/pipeline', label: 'Pipeline' },
    ],
  },
  {
    label: 'Configuration',
    items: [{ to: '/admin/taxonomy', label: 'Sector Options' }],
  },
  {
    label: 'Support / Governance',
    items: [
      { to: '/admin/enquiries', label: 'Enquiries' },
      { to: '/admin/erasure', label: 'Erasure' },
    ],
  },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-10 items-center rounded-lg border-l-2 pl-3 pr-2.5 text-sm font-semibold transition-colors ${
    isActive
      ? 'border-brand-600 bg-brand-50 text-brand-700'
      : 'border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50'
  }`;

function NavGroups({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="space-y-6">
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="px-3 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
            {group.label}
          </p>
          <div className="mt-1.5 space-y-0.5">
            {group.items.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end ?? false} className={navLinkClass} onClick={onNavigate}>
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <Link to="/admin" className="flex items-center gap-2.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-pub-navy font-heading text-sm font-bold text-white">
        BK
      </span>
      <span className="min-w-0">
        <span className="block font-heading text-base font-bold leading-tight text-pub-navy">
          BK Talent Connect
        </span>
        <span className="block text-[11px] leading-tight text-pub-muted">Admin portal</span>
      </span>
    </Link>
  );
}

/**
 * Mobile-only account access. The header has no room for the full email
 * address next to the hamburger and the bell on a 320px phone, so it and
 * Sign out move behind one more tap here — desktop shows both inline instead
 * (see the header below).
 */
function AccountMenu({ email, onSignOut }: { email: string | undefined; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const initial = (email ?? '?').trim().charAt(0).toUpperCase();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Account"
        className="flex size-11 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200"
      >
        {initial}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Account"
          className="absolute right-0 top-full z-40 mt-2 w-64 max-w-[85vw] rounded-xl border border-slate-200 bg-white p-3 shadow-lg shadow-slate-900/10"
        >
          <p className="truncate px-1 text-xs text-slate-500">{email}</p>
          <button
            type="button"
            onClick={onSignOut}
            className="mt-2 flex min-h-11 w-full items-center rounded-lg border border-pub-border px-3 text-sm font-semibold text-pub-navy transition-colors hover:bg-pub-blue-light"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function AdminShell() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close the drawer on route change (a NavLink click already does this via
  // onNavigate, but back/forward navigation and deep links do not fire that).
  useEffect(() => {
    setDrawerOpen(false);
  }, [navigate]);

  async function signOut() {
    await api.post('/auth/logout');
    await refresh();
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'auth' });
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      {/*
        * Desktop sidebar. lg:, not md: — at md: (768px, iPad portrait and
        * similar tablet widths) ten nav items in a persistent 256px sidebar
        * left too little room for actual page content on a tablet-sized
        * screen; Candidate and Employer already switch over at lg: (1024px),
        * so this now matches instead of switching a width earlier than they
        * do. Sticky rather than fixed so it scrolls away with a very long
        * nav list on a short viewport instead of clipping. Navigation and
        * branding only — no account controls here.
        */}
      <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col lg:border-r lg:border-pub-border lg:bg-white">
        <div className="border-b border-pub-border p-4">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <NavGroups />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-pub-border bg-white/95 px-4 py-3 backdrop-blur-sm sm:px-6">
          {/* Mobile-only brand + drawer trigger. Hidden on desktop, where the
              sidebar already carries the branding — nothing is duplicated. */}
          <div className="flex min-w-0 flex-1 items-center gap-2.5 lg:hidden">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-expanded={drawerOpen}
              aria-controls="admin-mobile-nav"
              aria-label="Open admin navigation"
              className="-ml-1.5 flex size-11 shrink-0 items-center justify-center rounded-lg text-pub-navy hover:bg-pub-bg"
            >
              <span aria-hidden="true" className="text-lg">☰</span>
            </button>
            <span className="min-w-0 truncate font-heading text-sm font-bold text-pub-navy">
              Admin portal
            </span>
          </div>

          {/* Desktop: [email] [bell] [Sign out], right-aligned, vertically
              centred. Mobile: just the bell plus the account-menu avatar —
              email and Sign out move behind that one tap (AccountMenu). */}
          <div className="ml-auto flex shrink-0 items-center gap-2 lg:gap-3">
            <span className="hidden max-w-[14rem] truncate text-sm text-slate-500 lg:inline">
              {user?.email}
            </span>
            <NotificationBell />
            <button
              type="button"
              onClick={signOut}
              className="hidden min-h-9 items-center rounded-lg border border-pub-border px-3.5 text-xs font-semibold text-pub-navy transition-colors hover:bg-pub-blue-light lg:inline-flex"
            >
              Sign out
            </button>
            <AccountMenu email={user?.email} onSignOut={signOut} />
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-6 sm:py-9">
          <Outlet />
        </main>
      </div>

      {/* Mobile drawer. A backdrop button (not a div) so it is keyboard- and
          screen-reader-reachable as a real dismiss control, not a click trap.
          Navigation only, same as the desktop sidebar — account access stays
          in the header's AccountMenu rather than being duplicated here too. */}
      {drawerOpen && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <button
            type="button"
            aria-label="Close admin navigation"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-slate-900/40"
          />
          <div
            id="admin-mobile-nav"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-pub-border p-4">
              <Brand />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close admin navigation"
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-pub-navy hover:bg-pub-bg"
              >
                <span aria-hidden="true" className="text-lg">✕</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 pb-safe">
              <NavGroups onNavigate={() => setDrawerOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
