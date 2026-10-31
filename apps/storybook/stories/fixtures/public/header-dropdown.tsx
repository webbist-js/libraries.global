import {
  HeaderDropdownContent,
  HeaderDropdownTrigger,
} from "@/components/global/HeaderDropdown"
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Popover } from "@/components/ui/popover"
import { Select, SelectItem, SelectValue } from "@/components/ui/select"
import { useState } from "react"

/** Real Radix roots provide the focus, selection and dismissal context. */
export function HeaderDropdownExample({
  kind,
  openOnMount = false,
}: {
  kind: "menu" | "select" | "popover"
  openOnMount?: boolean
}) {
  const [open, setOpen] = useState(openOnMount)
  // The opener leaves the tab order while its modal popup owns focus.
  const tabIndex = open && kind !== "popover" ? -1 : undefined
  if (kind === "select")
    return (
      <Select defaultValue="public" open={open} onOpenChange={setOpen}>
        <HeaderDropdownTrigger
          kind="select"
          tabIndex={tabIndex}
          aria-label="Library type"
        >
          <SelectValue />
        </HeaderDropdownTrigger>
        <HeaderDropdownContent kind="select">
          <SelectItem value="public">Public libraries</SelectItem>
          <SelectItem value="academic">Academic libraries</SelectItem>
        </HeaderDropdownContent>
      </Select>
    )
  if (kind === "popover")
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <HeaderDropdownTrigger kind="popover">
          About this library
        </HeaderDropdownTrigger>
        <HeaderDropdownContent kind="popover" aria-label="Library information">
          <h2 className="type-panel-title">Northbridge Library</h2>
          <p>
            Opening hours and access details are maintained by contributors.
          </p>
          <a href="/libraries/northbridge">View library details</a>
        </HeaderDropdownContent>
      </Popover>
    )

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <HeaderDropdownTrigger kind="menu" tabIndex={tabIndex}>
        Library actions
      </HeaderDropdownTrigger>
      <HeaderDropdownContent kind="menu">
        <DropdownMenuItem>Save library</DropdownMenuItem>
        <DropdownMenuItem>Suggest a correction</DropdownMenuItem>
        <DropdownMenuItem disabled>Staff tools unavailable</DropdownMenuItem>
      </HeaderDropdownContent>
    </DropdownMenu>
  )
}
