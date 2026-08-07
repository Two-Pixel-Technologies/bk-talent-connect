/**
 * Session state for the SPA.
 *
 * The server is the authority — this only mirrors what /api/auth/me reports.
 * Route guards here are a usability affordance; every rule is enforced again
 * server-side, because a client-side guard is bypassed by calling the API.
 */

import { createContext, useContext, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, useLocation } from 'react-router-dom';
import type { Role } from '@bktc/shared';
import { api, ApiError } from '../../lib/api-client.js';

export type CurrentUser = {
  readonly id: string;
  readonly email: string;
  readonly role: Role;
  readonly mustChangePassword: boolean;
  readonly approvalStatus: string | null;
  readonly createdAt: string;
};

type AuthValue = {
  readonly user: CurrentUser | null;
  readonly isLoading: boolean;
  refresh(): Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data, isPending } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      try {
        return await api.get<CurrentUser>('/auth/me');
      } catch (error) {
        // 401 is the normal signed-out state, not a failure worth surfacing.
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    /*
     * Retry transient failures — but never a 4xx.
     *
     * `retry: false` meant one dropped request signed the user out of the UI
     * while their session was perfectly alive: the query threw, `data` became
     * undefined, and `user` fell through to null. On a train in India that is
     * a common event, and being bounced to /login mid-form is an unpleasant
     * way to lose your work. A real 401 is caught above and returned as null,
     * so anything that reaches here is worth one more attempt.
     */
    retry: (failureCount, error) => {
      const status = (error as { status?: number }).status;
      if (status && status >= 400 && status < 500) return false;
      return failureCount < 2;
    },
    staleTime: 60_000,
  });

  const value: AuthValue = {
    user: data ?? null,
    isLoading: isPending,
    refresh: async () => {
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export const HOME_FOR_ROLE: Record<Role, string> = {
  CANDIDATE: '/candidate',
  EMPLOYER: '/employer',
  ADMIN: '/admin',
};

export function ProtectedRoute({
  role,
  children,
}: {
  role?: Role | readonly Role[];
  children: ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">Loading…</div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // A forced password change blocks everything except the change screen itself.
  if (user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  if (role) {
    const allowed = Array.isArray(role) ? role : [role];
    if (!allowed.includes(user.role)) {
      return <Navigate to={HOME_FOR_ROLE[user.role]} replace />;
    }
  }

  return <>{children}</>;
}
