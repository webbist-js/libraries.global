import { Icon } from "@iconify/react"

import GlobalLink from "@/components/global/GlobalLink"
import type { DriveGap, DriveGapKey } from "@/lib/community/drive-gaps-server"
import { staleCutoffDay } from "@/lib/community/stale-cutoff"
import { T, TYPE_TINT } from "@/lib/design-tokens"
import { proposeHref } from "@/lib/drives/propose-link"

const GAP_LOOK: Record<
  DriveGapKey,
  { icon: string; tint: { bg: string; fg: string } }
> = {
  hours: { icon: "mdi:clock-outline", tint: TYPE_TINT.public },
  photo: { icon: "mdi:camera-outline", tint: TYPE_TINT.special },
  accessibility: { icon: "mdi:human", tint: TYPE_TINT.academic },
  stale: { icon: "mdi:shield-check-outline", tint: TYPE_TINT.national },
}

const PILL =
  "inline-flex h-11 items-center gap-1.5 rounded-full border px-4 text-base font-semibold no-underline transition-colors hover:border-(--t-accent-primary)"

/** Every section a verify drive can confirm, for the stale row. */
const STALE_SECTIONS = ["hours", "status", "address", "contact"] as const

/**
 * A row's action: "Propose as a drive" opens the builder with this gap and
 * region chosen. The stale row proposes a verify drive: confirm every
 * section not checked since the stale cutoff's day.
 */
function gapAction(gap: DriveGap): {
  href: string
  label: string
  icon: string
} {
  const key = gap.key
  const places = { region: [gap.place.slug] }
  const href =
    key === "stale"
      ? proposeHref({
          focus: {
            kind: "verify",
            sections: [...STALE_SECTIONS],
            before: staleCutoffDay(new Date()),
          },
          places,
        })
      : proposeHref({ gaps: [key], places })

  return { href, label: "Propose as a drive", icon: "mdi:plus" }
}

/**
 * "Gaps worth a drive": kinds of missing detail, each in the region with
 * the most records missing it. Each count links to those records in Find
 * libraries, and each row proposes a drive for them. Renders nothing when
 * the index has no gaps to show.
 */
export function GapsWorthADrive({ gaps }: { readonly gaps: DriveGap[] }) {
  if (gaps.length === 0) return null

  return (
    <section aria-labelledby="gaps-heading" className="flex flex-col gap-3.5">
      <div>
        <h2
          id="gaps-heading"
          className="type-h2 m-0"
          style={{
            color: T.ink.base,
          }}
        >
          Gaps worth a drive
        </h2>
        <p className="m-0 mt-1.5 text-base" style={{ color: T.ink.dim }}>
          Found automatically in the index. Propose one and a Moderator will
          review it.
        </p>
      </div>
      <ul
        className="m-0 list-none overflow-hidden p-0"
        style={{
          background: T.bg.deep,
          border: `1px solid ${T.border.line}`,
          borderRadius: 24,
        }}
      >
        {gaps.map((gap, i) => {
          const look = GAP_LOOK[gap.key]
          const action = gapAction(gap)

          return (
            <li
              key={gap.key}
              className="flex flex-wrap items-center gap-3.5"
              style={{
                padding: "16px 18px",
                borderTop: i > 0 ? `1px solid ${T.border.divider}` : undefined,
              }}
            >
              <span
                aria-hidden="true"
                className="flex size-11 shrink-0 items-center justify-center rounded-[14px]"
                style={{ background: look.tint.bg, color: look.tint.fg }}
              >
                <Icon height={20} icon={look.icon} width={20} />
              </span>
              <span
                className="flex min-w-0 flex-col gap-0.5"
                style={{ flex: "1 1 220px" }}
              >
                <strong className="text-base" style={{ color: T.ink.base }}>
                  {gap.title}
                </strong>
                <GlobalLink
                  href={gap.href}
                  className="self-start text-base underline decoration-(--t-border-hi) underline-offset-[3px] hover:decoration-(--t-accent-primary)"
                  style={{ color: T.ink.dim }}
                >
                  <strong style={{ color: T.ink.base }}>
                    {gap.count.toLocaleString("en-GB")}
                  </strong>{" "}
                  {gap.count === 1 ? "record" : "records"} in {gap.place.name}
                </GlobalLink>
              </span>
              <GlobalLink
                href={action.href}
                className={PILL}
                style={{
                  borderColor: T.border.hi,
                  background: T.bg.deep,
                  color: T.ink.base,
                }}
              >
                <Icon
                  aria-hidden="true"
                  height={15}
                  icon={action.icon}
                  width={15}
                />
                {action.label}
                <span className="sr-only">
                  : {gap.title.toLowerCase()} in {gap.place.name}
                </span>
              </GlobalLink>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
