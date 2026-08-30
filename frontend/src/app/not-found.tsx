import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center">
        <div className="text-6xl mb-4">404</div>
        <h1 className="text-2xl mb-2">Page not found</h1>
        <p className="text-muted-foreground mb-8 max-w-md mx-auto">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex justify-center gap-3">
          <Link
            href="/"
            className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Go Home
          </Link>
          <Link
            href="/dashboard"
            className="border border-dashed border-hairline px-6 py-3 text-sm transition-colors hover:bg-surface"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
