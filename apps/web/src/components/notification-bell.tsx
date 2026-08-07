/**
 * The notification bell.
 *
 * Phase 1 has no email and no WhatsApp — this is the only channel, so it has
 * to work properly rather than be a decoration in the header. Opening the panel
 * does not mark anything read: people open a bell to look, and clearing the
 * badge on a glance is how a real notification gets lost.
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatRelative } from '@bktc/shared';
import { useAuth } from '../features/auth/auth-context.js';
import {
  routeFor,
  useMarkAllRead,
  useMarkRead,
  useNotifications,
  useUnreadCount,
  type NotificationItem,
} from '../features/notifications/use-notifications.js';

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const unread = useUnreadCount();
  const feed = useNotifications(open);
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  // Click-outside and Escape. Without these the panel is a trap on a phone,
  // where there is no obvious place to click to dismiss it.
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

  if (!user) return null;

  const count = unread.data?.count ?? 0;
  const items = feed.data?.items ?? [];

  function openItem(item: NotificationItem) {
    if (!item.read) markRead.mutate(item.id);
    const to = routeFor(item.link, user!.role, item.event);
    setOpen(false);
    if (to) navigate(to);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={count > 0 ? `Notifications, ${count} unread` : 'Notifications'}
        className="relative flex size-11 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100"
      >
        <span aria-hidden="true" className="text-lg">
          🔔
        </span>
        {count > 0 && (
          <span
            aria-hidden="true"
            className="absolute right-1 top-1 min-w-5 rounded-full bg-accent-600 px-1 text-center text-[11px] font-semibold leading-5 text-white"
          >
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          /*
           * Fixed and inset on a phone, anchored under the bell from sm up. A
           * 22rem dropdown positioned right-0 overflows a 360px viewport and
           * takes the whole page sideways with it.
           */
          className="fixed inset-x-2 top-16 z-40 max-h-[70vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-88"
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Notifications</h2>
            {count > 0 && (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="text-xs font-medium text-brand-700 hover:underline disabled:opacity-50"
              >
                Mark all read
              </button>
            )}
          </div>

          {feed.isPending && <p className="px-4 py-6 text-sm text-slate-500">Loading…</p>}

          {feed.isError && (
            <p className="px-4 py-6 text-sm text-accent-700">
              We could not load your notifications. Try again in a moment.
            </p>
          )}

          {feed.isSuccess && items.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              Nothing yet. We will tell you here when something moves.
            </p>
          )}

          <ul>
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => openItem(item)}
                  className={`flex w-full flex-col gap-1 border-b border-slate-100 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${
                    item.read ? '' : 'bg-brand-50/50'
                  }`}
                >
                  <span className="flex items-start gap-2">
                    {!item.read && (
                      <span
                        aria-hidden="true"
                        className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-600"
                      />
                    )}
                    <span
                      className={`text-sm ${item.read ? 'text-slate-700' : 'font-semibold text-slate-900'}`}
                    >
                      {item.title}
                    </span>
                  </span>
                  {item.body && (
                    <span className="pl-4 text-xs leading-relaxed text-slate-600">{item.body}</span>
                  )}
                  <span className="pl-4 text-[11px] text-slate-400">
                    {formatRelative(item.createdAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
