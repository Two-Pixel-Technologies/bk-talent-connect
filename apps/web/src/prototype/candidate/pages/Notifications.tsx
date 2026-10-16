import { Link } from 'react-router-dom';
import { usePrototype } from '../PrototypeContext.js';
import { EmptyState } from '../components/ui.js';
import { EmptyBoxArt } from '../components/illustrations.js';
import { PUBLIC_ICONS, type PublicIconKey } from '../../../components/icons/public-icons.js';
import type { NotificationKind } from '../mock-data.js';

const KIND_ICON: Record<NotificationKind, PublicIconKey> = {
  STAGE: 'clipboardCheck',
  INTERVIEW: 'clock',
  PROFILE: 'shieldCheck',
  JOB: 'briefcase',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function Notifications() {
  const { notifications, markNotificationRead, markAllNotificationsRead } = usePrototype();
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-pub-navy">Notifications</h1>
          <p className="mt-1 text-sm text-pub-muted">Updates on your applications, interviews and profile.</p>
        </div>
        {unread > 0 && (
          <button onClick={markAllNotificationsRead} className="text-xs font-semibold text-pub-blue hover:underline">
            Mark all as read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <EmptyState icon={<EmptyBoxArt className="size-8" />} title="You're all caught up" description="New updates will appear here." />
      ) : (
        <div className="divide-y divide-pub-border overflow-hidden rounded-2xl border border-pub-border bg-white shadow-sm">
          {notifications.map((n) => {
            const Icon = PUBLIC_ICONS[KIND_ICON[n.kind]];
            return (
              <Link
                key={n.id}
                to={n.linkTo ?? '#'}
                onClick={() => markNotificationRead(n.id)}
                className={`flex items-start gap-3 p-4 transition-colors hover:bg-pub-bg sm:p-5 ${n.read ? '' : 'bg-pub-blue-light/30'}`}
              >
                <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${n.read ? 'bg-pub-bg text-pub-muted' : 'bg-pub-blue-light text-pub-blue'}`}>
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-pub-navy">{n.title}</p>
                    {!n.read && <span className="size-1.5 shrink-0 rounded-full bg-pub-blue" />}
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-pub-muted">{n.body}</p>
                  <p className="mt-1 text-[11px] text-pub-muted">{formatDate(n.createdAt)}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
