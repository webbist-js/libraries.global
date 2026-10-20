import { getTranslations } from "next-intl/server"

import { SectionNavigation } from "@/components/ds/SectionNavigation"
import {
  StaffHeroSkeleton,
  StaffWorkspaceSkeleton,
} from "@/components/staff/StaffWorkspaceSkeleton"
import { Skeleton } from "@/components/ui/skeleton"

export default async function StaffLoading() {
  const t = await getTranslations("general")

  return (
    <>
      <StaffHeroSkeleton />
      <SectionNavigation>
        <div
          aria-hidden="true"
          className="flex min-h-14 gap-6 overflow-hidden py-5"
        >
          {[0, 1, 2].map((item) => (
            <Skeleton key={item} className="h-4 w-32 shrink-0 rounded-full" />
          ))}
        </div>
      </SectionNavigation>
      <StaffWorkspaceSkeleton label={t("loading")} />
    </>
  )
}
