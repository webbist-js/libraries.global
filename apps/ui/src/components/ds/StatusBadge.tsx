import { Icon } from "@iconify/react"
import type { ReactNode } from "react"

import { T } from "@/lib/design-tokens"

const tones = {
  ok: { color: T.accent.ok, icon: "mdi:check-circle-outline" },
  info: { color: T.accent.primary, icon: "mdi:information-outline" },
  warn: { color: T.accent.warn, icon: "mdi:alert-outline" },
  danger: { color: T.accent.danger, icon: "mdi:alert-circle-outline" },
  neutral: { color: T.ink.dim, icon: "mdi:clock-outline" },
}

export function StatusBadge({
  tone,
  icon,
  children,
  pulse,
}: {
  readonly tone: keyof typeof tones
  readonly icon?: string
  readonly children: ReactNode
  readonly pulse?: boolean
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold"
      style={{
        color: tones[tone].color,
        borderColor: tone === "neutral" ? T.border.line : T.edge[tone],
        background: T.bg.deep,
      }}
    >
      <Icon
        aria-hidden="true"
        icon={icon ?? tones[tone].icon}
        className={pulse ? "motion-safe:animate-pulse" : undefined}
        width={16}
      />
      {children}
    </span>
  )
}
