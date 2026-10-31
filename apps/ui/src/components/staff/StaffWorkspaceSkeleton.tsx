import { Container } from "@/components/elementary/Container"
import { Skeleton } from "@/components/ui/skeleton"

export function StaffWorkspaceSkeleton({ label }: { readonly label: string }) {
  return (
    <Container className="py-8 sm:py-12">
      <div role="status" className="sr-only">
        {label}
      </div>
      <div
        aria-hidden="true"
        className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]"
      >
        <div className="min-w-0 space-y-6">
          {[0, 1].map((panel) => (
            <div
              key={panel}
              className="rounded-3xl border border-(--t-border-line) bg-(--t-bg-deep) p-5 sm:p-7"
            >
              <Skeleton className="mb-6 h-8 w-48 rounded-lg" />
              <div className="space-y-5">
                {[0, 1, 2].map((row) => (
                  <div
                    key={row}
                    className="flex items-center gap-4 border-t border-(--t-border-line) pt-5"
                  >
                    <Skeleton className="size-11 shrink-0 rounded-full" />
                    <div className="grid w-full gap-3">
                      <Skeleton className="h-4 w-2/3 rounded-full" />
                      <Skeleton className="h-3 w-4/5 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-6">
          {[0, 1].map((panel) => (
            <div
              key={panel}
              className="rounded-3xl border border-(--t-border-line) bg-(--t-bg-deep) p-6"
            >
              <Skeleton className="mb-6 h-7 w-36 rounded-lg" />
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="mt-5 h-11 w-36 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </Container>
  )
}

/** Matches a staff hero: Team title and supporting copy, without a search field. */
export function StaffHeroSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="rounded-[20px] border border-(--t-border-line) bg-(--t-bg-deep)"
    >
      <Container className="p-6 sm:p-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)] lg:items-end">
          <div>
            <Skeleton className="mb-4 h-7 w-36 rounded-full" />
            <Skeleton className="h-14 w-4/5 rounded-lg" />
            <Skeleton className="mt-3 h-14 w-2/3 rounded-lg" />
          </div>
          <div className="grid gap-3">
            <Skeleton className="h-4 w-full rounded-full" />
            <Skeleton className="h-4 w-full rounded-full" />
            <Skeleton className="h-4 w-2/3 rounded-full" />
          </div>
        </div>
      </Container>
    </div>
  )
}
