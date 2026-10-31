import { getTranslations } from "next-intl/server"

import {
  StaffHeroSkeleton,
  StaffWorkspaceSkeleton,
} from "@/components/staff/StaffWorkspaceSkeleton"

export default async function StaffLoading() {
  const t = await getTranslations("general")

  return (
    <>
      <StaffHeroSkeleton />
      <StaffWorkspaceSkeleton label={t("loading")} />
    </>
  )
}
