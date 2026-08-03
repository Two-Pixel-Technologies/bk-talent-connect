import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 text-center">
      <p className="text-6xl font-bold text-brand-200">404</p>
      <h1 className="mt-4 text-2xl font-semibold text-brand-900">Page not found</h1>
      <p className="mt-2 text-slate-600">
        That page doesn&rsquo;t exist, or you don&rsquo;t have access to it.
      </p>
      <Link
        to="/"
        className="mt-8 inline-block rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white hover:bg-brand-700"
      >
        Back to safety
      </Link>
    </main>
  );
}
