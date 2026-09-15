export function BarListChart({
  items,
}: {
  items: { label: string; count: number }[];
}) {
  const max = Math.max(1, ...items.map((i) => i.count));

  return (
    <div className="flex flex-col gap-2.5">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <div className="w-24 shrink-0 truncate text-xs text-muted">
            {item.label}
          </div>
          <div className="h-5 flex-1 overflow-hidden rounded bg-background">
            <div
              className="h-full rounded bg-accent transition-[width]"
              style={{ width: `${(item.count / max) * 100}%` }}
            />
          </div>
          <div className="w-6 shrink-0 text-right text-xs font-medium text-foreground">
            {item.count}
          </div>
        </div>
      ))}
    </div>
  );
}

export function TrendBarChart({
  points,
}: {
  points: { label: string; count: number }[];
}) {
  const max = Math.max(1, ...points.map((p) => p.count));

  return (
    <div className="flex h-24 items-end gap-1">
      {points.map((point, i) => (
        <div
          key={i}
          className="flex-1"
          title={`${point.label}: ${point.count}`}
        >
          <div
            className="rounded-t bg-accent/70 transition-colors hover:bg-accent"
            style={{
              height: `${Math.max(4, Math.round((point.count / max) * 96))}px`,
            }}
          />
        </div>
      ))}
    </div>
  );
}
