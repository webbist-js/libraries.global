import { ChevronDown, UsersRound } from "lucide-react"

import { HowReviewWorks } from "@/app/[locale]/(dashboard)/contribute/_components/hub/HowReviewWorks"
import { RolesTable } from "@/app/[locale]/(dashboard)/contribute/_components/hub/RolesTable"
import {
  TakeOnARole,
  type RoleOpportunities,
} from "@/app/[locale]/(dashboard)/contribute/_components/hub/TakeOnARole"

/** Review guidance and available roles share one surface, with no empty slots. */
export function ContributionJourney({
  showReview = true,
  ...props
}: RoleOpportunities & { readonly showReview?: boolean }) {
  return (
    <div className="mx-auto w-full max-w-[1360px] px-4 py-8 sm:px-8">
      <div className="overflow-hidden rounded-[28px] border border-(--t-border-line) bg-(--t-bg-deep)">
        {showReview ? <HowReviewWorks /> : null}
        <TakeOnARole {...props} />
        <details className="group border-t border-(--t-border-line)">
          <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 px-6 py-4 text-sm font-semibold text-(--t-accent-primary) hover:bg-(--t-bg-surface) focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-(--t-accent-primary) sm:px-8 [&::-webkit-details-marker]:hidden">
            <UsersRound size={16} aria-hidden />
            Compare roles and permissions
            <ChevronDown
              size={16}
              className="ml-auto group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <RolesTable />
        </details>
      </div>
    </div>
  )
}
