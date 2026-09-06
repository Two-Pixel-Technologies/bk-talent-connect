/**
 * CANDIDATE PORTAL PROTOTYPE — portal shell (navigation + header).
 *
 * Desktop/tablet: fixed left sidebar + slim top bar. Mobile: top bar +
 * fixed bottom tab bar (the 4 primary destinations only — Profile and
 * Settings live behind the avatar menu on mobile to keep the bar
 * uncluttered). Reusable as-is if lifted into the real portal later; the
 * only prototype-specific bit is the `basePath` prefix and mock notification
 * count, both passed in as props.
 */

import { useState, type ReactNode } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { PUBLIC_ICONS } from '../../../components/icons/public-icons.js';

const BASE = '/prototype/candidate';

const NAV_ITEMS = [
  { to: `${BASE}/dashboard`, label: 'Dashboard', icon: 'clock' as const },
  { to: `${BASE}/jobs`, label: 'Jobs', icon: 'briefcase' as const },
  { to: `${BASE}/applications`, label: 'Applications', icon: 'clipboardCheck' as const },
  { to: `${BASE}/notifications`, label: 'Notifications', icon: 'bell' as const },
  { to: `${BASE}/profile`, label: 'Profile', icon: 'userCheck' as const },
  { to: `${BASE}/settings`, label: 'Settings', icon: 'lock' as const },
];

const MOBILE_TABS = NAV_ITEMS.slice(0, 4);

export function PortalShell({
  children,
  unreadCount = 0,
  candidateName = 'Ananya Verma',
}: {
  children: ReactNode;
  unreadCount?: number;
  candidateName?: string;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const initials = candidateName
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-pub-bg">
      <div className="mx-auto flex w-full max-w-[92rem]">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-pub-border bg-white lg:flex">
          <Link to="/" className="flex items-center gap-2.5 border-b border-pub-border px-5 py-4">
            <span className="flex size-9 items-center justify-center rounded-lg bg-pub-navy font-heading text-sm font-bold text-white">
              BK
            </span>
            <span className="font-heading text-sm font-bold text-pub-navy">BK Talent Connect</span>
          </Link>
          <nav className="flex-1 space-y-1 px-3 py-4">
            {NAV_ITEMS.map((item) => {
              const Icon = PUBLIC_ICONS[item.icon];
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
                      isActive ? 'bg-pub-blue-light text-pub-blue' : 'text-pub-muted hover:bg-pub-bg hover:text-pub-navy'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon className="size-4.5" />
                      {item.label}
                      {item.label === 'Notifications' && unreadCount > 0 && (
                        <span
                          className={`ml-auto flex size-5 items-center justify-center rounded-full text-[10px] font-bold ${
                            isActive ? 'bg-pub-blue text-white' : 'bg-pub-blue/10 text-pub-blue'
                          }`}
                        >
                          {unreadCount}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>
          <div className="border-t border-pub-border p-3">
            <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
              <span className="flex size-8 items-center justify-center rounded-full bg-pub-blue-light text-xs font-bold text-pub-blue">
                {initials}
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-pub-navy">{candidateName}</p>
                <p className="text-[11px] text-pub-muted">Candidate</p>
              </div>
            </div>
          </div>
        </aside>

        <div className="min-h-screen min-w-0 flex-1">
          {/* Top bar */}
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-pub-border bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
            <button
              className="flex size-9 items-center justify-center rounded-lg text-pub-navy lg:hidden"
              aria-label="Open menu"
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen((v) => !v)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="size-5">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <p className="hidden font-heading text-sm font-bold text-pub-navy lg:block">Candidate Portal</p>
            <div className="flex items-center gap-3">
              <Link to={`${BASE}/notifications`} className="relative flex size-9 items-center justify-center rounded-full text-pub-navy hover:bg-pub-bg lg:hidden">
                <PUBLIC_ICONS.bell className="size-5" />
                {unreadCount > 0 && (
                  <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-pub-blue text-[9px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </Link>
              <span className="flex size-8 items-center justify-center rounded-full bg-pub-blue-light text-xs font-bold text-pub-blue lg:hidden">
                {initials}
              </span>
            </div>
          </header>

          {/* Mobile drawer */}
          {drawerOpen && (
            <div className="border-b border-pub-border bg-white px-4 py-3 lg:hidden">
              <nav className="grid grid-cols-2 gap-2">
                {NAV_ITEMS.map((item) => {
                  const Icon = PUBLIC_ICONS[item.icon];
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setDrawerOpen(false)}
                      className={({ isActive }) =>
                        `flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium ${
                          isActive ? 'bg-pub-blue-light text-pub-blue' : 'text-pub-muted'
                        }`
                      }
                    >
                      <Icon className="size-4" />
                      {item.label}
                    </NavLink>
                  );
                })}
              </nav>
            </div>
          )}

          <main className="mx-auto max-w-6xl px-4 py-6 pb-24 sm:px-6 sm:py-8 lg:pb-8">{children}</main>
        </div>
      </div>

      {/* Mobile bottom tab bar — primary destinations only. Each tab gets an
          equal, shrinkable share of the width (min-w-0 + truncate) so 4
          labels never push the bar wider than a 320px viewport. */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-pub-border bg-white/95 py-1.5 backdrop-blur pb-safe lg:hidden">
        {MOBILE_TABS.map((item) => {
          const Icon = PUBLIC_ICONS[item.icon];
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-1 text-[9px] font-medium ${isActive ? 'text-pub-blue' : 'text-pub-muted'}`
              }
            >
              {() => (
                <>
                  <span className="relative">
                    <Icon className="size-5" />
                    {item.label === 'Notifications' && unreadCount > 0 && (
                      <span className="absolute -right-1.5 -top-1 flex size-3.5 items-center justify-center rounded-full bg-pub-blue text-[8px] font-bold text-white">
                        {unreadCount}
                      </span>
                    )}
                  </span>
                  <span className="max-w-full truncate">{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
