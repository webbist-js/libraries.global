import { Skeleton } from "@/components/ui/skeleton"

/** No contributor details from a previous request appear while the queue changes. */
export function ModerationQueueSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="overflow-hidden rounded-[24px] border border-(--t-border-line) bg-(--t-bg-deep)"
    >
      {[0, 1, 2, 3].map((row) => (
        <div
          key={row}
          className="flex items-center gap-4 border-b border-(--t-border-line) p-5 last:border-b-0"
        >
          <Skeleton className="size-10 shrink-0 rounded-full bg-(--t-border-line)" />
          <div className="grid flex-1 gap-3">
            <Skeleton className="h-4 w-3/4 bg-(--t-border-line)" />
            <Skeleton className="h-3 w-1/2 bg-(--t-border-line)" />
          </div>
          <Skeleton className="hidden h-7 w-20 rounded-full bg-(--t-border-line) sm:block" />
        </div>
      ))}
    </div>
  )
}
