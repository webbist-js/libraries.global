"use client"

import { usePathname } from "next/navigation"

import { StickySubNav } from "@/components/ds"

const NAV_ITEMS = [
  { id: "hub", href: "/contribute", label: "Hub" },
  { id: "community", href: "/contribute/community", label: "Community" },
  { id: "add", href: "/contribute/add", label: "Add to the index" },
  { id: "edit", href: "/contribute/edit", label: "Edit the index" },
  {
    id: "submissions",
    href: "/contribute/submissions",
    label: "My submissions",
  },
] as const

export function ContributeNavBar() {
  const pathname = usePathname()

  const activeId =
    NAV_ITEMS.find(({ href, id }) => {
      if (id === "hub") {
        return (
          pathname === "/contribute" ||
          pathname === "/en/contribute" ||
          pathname.endsWith("/contribute")
        )
      }

      return pathname.includes(href.slice("/contribute".length))
    })?.id ?? "hub"

  return <StickySubNav tabs={[...NAV_ITEMS]} activeId={activeId} />
}
