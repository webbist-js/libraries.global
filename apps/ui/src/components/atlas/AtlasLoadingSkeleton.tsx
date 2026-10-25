import { Skeleton } from "@/components/ui/skeleton"

/** Actual loading state; no placeholder numbers or artificial minimum delay. */
export function AtlasLoadingSkeleton({
  label,
  compact = false,
}: {
  readonly label: string
  readonly compact?: boolean
}) {
  return (
    <div role="status" aria-busy="true" className="atlas-loading space-y-3">
      <p className="m-0 text-xs leading-relaxed text-(--t-ink-dim)">{label}</p>
      <div aria-hidden="true" className="space-y-3">
        {!compact ? (
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-10 bg-(--t-bg-muted)" />
            <Skeleton className="h-10 bg-(--t-bg-muted)" />
          </div>
        ) : null}
        <div className="space-y-3 rounded-2xl border border-(--t-border-line) bg-(--t-bg-surface) p-4">
          <Skeleton className="h-3 w-1/2 bg-(--t-border-line)" />
          <Skeleton className="h-10 w-2/5 bg-(--t-border-line)" />
          <Skeleton className="h-3 w-4/5 bg-(--t-border-line)" />
          <Skeleton className="h-3 w-3/5 bg-(--t-border-line)" />
        </div>
      </div>
    </div>
  )
}
