import { Icon } from "@iconify/react"

import { T } from "@/lib/design-tokens"

const STAGES = [
  {
    chip: "Submitted",
    icon: "mdi:send-outline",
    bg: "var(--t-bg-muted)",
    fg: "#55536A",
    copy: "Your change is saved and waiting for a reviewer.",
  },
  {
    chip: "In review",
    icon: "mdi:clock-outline",
    bg: "var(--tint-academic-bg)",
    fg: "var(--tint-academic-fg)",
    copy: "A trusted contributor is checking it against your source.",
  },
  {
    chip: "Needs changes",
    icon: "mdi:undo-variant",
    bg: "#F5EEDC",
    fg: "#6B5420",
    copy: "The reviewer asked a question or needs a better source. Nothing is lost.",
  },
  {
    chip: "Accepted",
    icon: "mdi:check",
    bg: "var(--tint-public-bg)",
    fg: "var(--tint-public-fg)",
    copy: "Published with your name in the record's history.",
  },
  {
    chip: "Not accepted",
    icon: "mdi:close",
    bg: "var(--tint-special-bg)",
    fg: "var(--tint-special-fg)",
    copy: "Explained with a reason, such as a duplicate or an unverifiable claim.",
  },
] as const

export function HowReviewWorks() {
  return (
    <section className="mx-auto w-full max-w-[1360px] px-4 py-12 sm:px-8">
      <h2
        className="m-0"
        style={{
          fontFamily: T.font.serif,
          fontSize: "clamp(26px,3vw,32px)",
          fontWeight: 500,
          letterSpacing: "-0.01em",
          color: T.ink.base,
        }}
      >
        How review works
      </h2>
      <p
        className="mt-2 mb-6 max-w-[62ch] text-[16px] leading-[1.6]"
        style={{ color: T.ink.dim }}
      >
        Every change is checked before it&rsquo;s published, and every published
        change is credited to you and kept in the record&rsquo;s history.
      </p>

      <ol className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-5">
        {STAGES.map((stage) => (
          <li
            key={stage.chip}
            className="rounded-[18px] p-5"
            style={{
              background: T.bg.deep,
              border: `1px solid ${T.border.line}`,
            }}
          >
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold"
              style={{ background: stage.bg, color: stage.fg }}
            >
              <Icon
                icon={stage.icon}
                width={13}
                height={13}
                aria-hidden="true"
              />
              {stage.chip}
            </span>
            <p
              className="mt-3 mb-0 text-[14.5px] leading-[1.55]"
              style={{ color: T.ink.dim }}
            >
              {stage.copy}
            </p>
          </li>
        ))}
      </ol>
    </section>
  )
}
