import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context.js';

const HOME_FOR_ROLE: Record<string, string> = {
  CANDIDATE: '/candidate',
  EMPLOYER: '/employer',
  ADMIN: '/admin',
};

export function NotFoundPage() {
  const { user } = useAuth();

  /*
   * Signed-in users go back to their own portal.
   *
   * "Back to safety" pointed everyone at the public landing page, which for
   * someone already signed in is a step further away from what they were
   * doing, not closer.
   */
  const destination = user ? (HOME_FOR_ROLE[user.role] ?? '/') : '/';

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 text-center">
      <p className="text-6xl font-bold text-brand-200">404</p>
      <h1 className="mt-4 text-2xl font-semibold text-brand-900">Page not found</h1>
      <p className="mt-2 text-slate-600">
        That page doesn&rsquo;t exist, or you don&rsquo;t have access to it.
      </p>
      <Link
        to={destination}
        className="mt-8 inline-block min-h-11 rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white hover:bg-brand-700"
      >
        {user ? 'Back to your dashboard' : 'Back to safety'}
      </Link>
    </main>
  );
}
