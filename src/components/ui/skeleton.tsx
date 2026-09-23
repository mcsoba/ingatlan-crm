export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-skeleton rounded-md bg-border-subtle ${className}`}
    />
  );
}

export function SkeletonStatRow({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4"
        >
          <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-5 w-10" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex items-center gap-4 border-b border-border-subtle px-4 py-3">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-3.5 w-20" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-border-subtle px-4 py-3.5 last:border-0"
        >
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3.5 w-36" />
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="ml-auto h-5 w-14 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-xl border border-border bg-surface p-3"
        >
          <Skeleton className="mb-3 -mx-3 -mt-3 h-32 rounded-none" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="mt-2 h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonBoard({ columns = 4 }: { columns?: number }) {
  return (
    <div className="flex gap-4 overflow-hidden">
      {Array.from({ length: columns }).map((_, i) => (
        <div key={i} className="flex w-64 shrink-0 flex-col gap-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-24 rounded-xl" />
          {i % 2 === 0 && <Skeleton className="h-24 rounded-xl" />}
        </div>
      ))}
    </div>
  );
}

export function SkeletonForm({ fields = 5 }: { fields?: number }) {
  return (
    <div className="max-w-md rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-col gap-4">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-9 rounded-lg" />
          </div>
        ))}
        <Skeleton className="mt-1 h-9 w-28 rounded-lg" />
      </div>
    </div>
  );
}

export function SkeletonPageHeader() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-3.5 w-64" />
    </div>
  );
}
