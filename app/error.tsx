'use client';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-background p-6 text-center">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground break-words">{error.message || 'Unknown error'}</p>
      {error.digest && <p className="mt-1 text-xs text-muted-foreground">Digest: {error.digest}</p>}
      <button onClick={reset} className="mt-4 rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
        Reload
      </button>
    </div>
  );
}
