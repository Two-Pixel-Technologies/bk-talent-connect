/**
 * CANDIDATE PORTAL PROTOTYPE — shared in-memory state.
 *
 * Every "mutation" (apply, withdraw, mark notification read, edit profile)
 * updates this React state only. Nothing here calls fetch/the API client;
 * refreshing the page resets to the seed data in mock-data.ts by design.
 */

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  initialApplications,
  initialCandidate,
  initialNotifications,
  mockJobs,
  type MockApplication,
  type MockCandidate,
  type MockNotification,
} from './mock-data.js';

interface PrototypeState {
  candidate: MockCandidate;
  setCandidate: React.Dispatch<React.SetStateAction<MockCandidate>>;
  applications: MockApplication[];
  applyToJob: (jobId: string) => void;
  withdrawApplication: (applicationId: string) => void;
  confirmInterview: (applicationId: string) => void;
  notifications: MockNotification[];
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  unreadCount: number;
}

const PrototypeStateContext = createContext<PrototypeState | null>(null);

export function PrototypeProvider({ children }: { children: ReactNode }) {
  const [candidate, setCandidate] = useState<MockCandidate>(initialCandidate);
  const [applications, setApplications] = useState<MockApplication[]>(initialApplications);
  const [notifications, setNotifications] = useState<MockNotification[]>(initialNotifications);

  function applyToJob(jobId: string) {
    const job = mockJobs.find((j) => j.id === jobId);
    if (!job) return;
    if (applications.some((a) => a.job.id === jobId)) return;
    const now = new Date().toISOString();
    setApplications((prev) => [
      { id: `app-${Date.now()}`, job, stage: 'APPLIED', appliedAt: now.slice(0, 10), history: [{ stage: 'APPLIED', at: now }] },
      ...prev,
    ]);
  }

  function withdrawApplication(applicationId: string) {
    setApplications((prev) =>
      prev.map((a) =>
        a.id === applicationId
          ? { ...a, stage: 'WITHDRAWN', history: [...a.history, { stage: 'WITHDRAWN', at: new Date().toISOString() }] }
          : a,
      ),
    );
  }

  function confirmInterview(applicationId: string) {
    setApplications((prev) =>
      prev.map((a) => (a.id === applicationId && a.interview ? { ...a, interview: { ...a.interview, confirmed: true } } : a)),
    );
  }

  function markNotificationRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }

  function markAllNotificationsRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  const value = useMemo<PrototypeState>(
    () => ({
      candidate,
      setCandidate,
      applications,
      applyToJob,
      withdrawApplication,
      confirmInterview,
      notifications,
      markNotificationRead,
      markAllNotificationsRead,
      unreadCount,
    }),
    [candidate, applications, notifications, unreadCount],
  );

  return <PrototypeStateContext.Provider value={value}>{children}</PrototypeStateContext.Provider>;
}

export function usePrototype(): PrototypeState {
  const ctx = useContext(PrototypeStateContext);
  if (!ctx) throw new Error('usePrototype must be used within PrototypeProvider');
  return ctx;
}
