"use client"

import { useTranslations } from "next-intl"

import { DrawerEdgeTab } from "@/components/ds/DrawerEdgeTab"

export function StaffDrawerTab({ onOpen }: { readonly onOpen: () => void }) {
  const t = useTranslations("ui")
  const d = useTranslations("dashboard")

  return (
    <DrawerEdgeTab
      accessibleLabel={t("open_the_staff_drawer")}
      title={t("staff_drawer_alts")}
      label={d("staff")}
      icon="mdi:account-group-outline"
      onOpen={onOpen}
    />
  )
}
