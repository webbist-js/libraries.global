"use client"

import { useId } from "react"

import { ChoiceCard } from "@/components/ds"

type Visibility = "public" | "limited" | "private"

const OPTIONS: {
  value: Visibility
  label: string
  desc: string
  icon: string
  tint: { bg: string; fg: string }
}[] = [
  {
    value: "public",
    label: "Public",
    desc: "Indexed and findable. Recommended for librarians and contributors.",
    icon: "mdi:earth",
    tint: { bg: "var(--tint-public-bg)", fg: "var(--tint-public-fg)" },
  },
  {
    value: "limited",
    label: "Limited",
    desc: "Contact details and location visible only to members of libraries you're affiliated with.",
    icon: "mdi:account-group-outline",
    tint: { bg: "var(--tint-academic-bg)", fg: "var(--tint-academic-fg)" },
  },
  {
    value: "private",
    label: "Private",
    desc: "Anonymous on contributions; profile page is hidden.",
    icon: "mdi:lock-outline",
    tint: { bg: "var(--tint-neutral-bg)", fg: "var(--tint-neutral-fg)" },
  },
]

/** Profile visibility as radio cards. The caller names the group. */
export function VisibilityCards({
  value,
  onChange,
}: {
  value: Visibility
  onChange: (v: Visibility) => void
}) {
  const name = useId()

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {OPTIONS.map((opt) => (
        <ChoiceCard
          key={opt.value}
          name={name}
          value={opt.value}
          checked={opt.value === value}
          onChange={() => onChange(opt.value)}
          icon={opt.icon}
          tint={opt.tint}
          title={opt.label}
          hint={opt.desc}
        />
      ))}
    </div>
  )
}
