import { Icon } from "@iconify/react"

import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

/**
 * "‹ Event feeds": the way back from a task page inside the staff shell
 * (connect a feed, replace its details) to the tab it came from. A 44 px
 * outlined pill, so it reads like the shell's other actions.
 */
export function StaffBackLink({
  href,
  label,
}: {
  readonly href: string
  readonly label: string
}) {
  return (
    <p className="m-0 mb-5">
      <Link
        href={href}
        className="inline-flex min-h-11 items-center gap-1 rounded-full border bg-(--t-bg-deep) pr-4 pl-3 text-sm font-semibold no-underline transition-colors hover:bg-(--t-bg-surface)"
        style={{ borderColor: T.border.hi, color: T.ink.base }}
      >
        <Icon
          aria-hidden="true"
          height={18}
          icon="mdi:chevron-left"
          style={{ color: T.accent.primary }}
          width={18}
        />
        {label}
      </Link>
    </p>
  )
}
