import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NotificationEntityType, NotificationEvent, Page, Role } from '@bktc/shared';
import { api } from '../../lib/api-client.js';

export type NotificationLink = {
  entityType: NotificationEntityType;
  entityId: string;
};

export type NotificationItem = {
  id: string;
  event: NotificationEvent;
  title: string;
  body: string | null;
  link: NotificationLink | null;
  read: boolean;
  createdAt: string;
};

/**
 * The unread badge.
 *
 * Polled rather than pushed. Websockets for a three-role portal with a handful
 * of concurrent users is infrastructure to run and monitor for a year in
 * exchange for a fresher number; a minute of staleness on a bell is not worth
 * that. `refetchOnWindowFocus` covers the case people actually notice — coming
 * back to the tab after doing something in another one.
 */
export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.get<{ count: number }>('/notifications/unread-count'),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
}

export function useNotifications(enabled: boolean) {
  return useQuery({
    queryKey: ['notifications', 'feed'],
    queryFn: () => api.get<Page<NotificationItem>>('/notifications?pageSize=20'),
    enabled,
  });
}

export function useMarkRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<void>(`/notifications/${id}/read`),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ markedRead: number }>('/notifications/read-all'),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

/**
 * Turns a stored subject into a route for whoever is reading it.
 *
 * This is why the server stores {entityType, entityId} rather than a URL: the
 * same application id sends a candidate to their tracker, an employer to their
 * applicant list and an admin to the pipeline. A URL baked in at write time
 * would have to pick one, and would break on the next route rename besides.
 */
export function routeFor(
  link: NotificationLink | null,
  role: Role,
  event?: NotificationEvent,
): string | null {
  if (!link) return null;

  /*
   * Event first, because the subject alone is sometimes the wrong signal.
   *
   * An employer asking for an interview carries an APPLICATION, so the generic
   * mapping sent the admin to the pipeline — while interviews are arranged on
   * the coordination screen. The notification that most needs acting on landed
   * on the page where you cannot act on it.
   */
  if (role === 'ADMIN' && event) {
    if (event === 'EMPLOYER_INTERVIEW_REQUESTED' || event === 'INTERVIEW_CONFIRMED') {
      return '/admin/coordination';
    }
  }

  switch (link.entityType) {
    case 'CANDIDATE':
      return role === 'CANDIDATE' ? '/candidate/profile' : `/admin/candidates?focus=${link.entityId}`;
    case 'EMPLOYER':
      return role === 'EMPLOYER' ? '/employer/company' : `/admin/employers?focus=${link.entityId}`;
    case 'JOB':
      if (role === 'EMPLOYER') return `/employer/jobs/${link.entityId}`;
      if (role === 'ADMIN') return `/admin/jobs?focus=${link.entityId}`;
      return `/candidate/jobs/${link.entityId}`;
    case 'APPLICATION':
      if (role === 'CANDIDATE') return '/candidate/applications';
      if (role === 'ADMIN') return `/admin/pipeline?focus=${link.entityId}`;
      return '/employer/jobs';
    case 'INTERVIEW':
      if (role === 'CANDIDATE') return '/candidate/applications';
      if (role === 'ADMIN') return '/admin/coordination';
      return '/employer/jobs';
    default:
      return null;
  }
}
