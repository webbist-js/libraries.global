import { Icon } from "@iconify/react"

import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"

const DRIVE_STEPS = [
  {
    title: "Someone proposes a gap",
    text: "A place plus one missing detail, with a public source.",
  },
  { title: "A moderator pins it", text: "With a goal and an end date." },
  {
    title: "Everyone chips in",
    text: "Small tasks, each checked by a reviewer.",
  },
]

/**
 * The Noticeboard's first card until drives exist (D1 replaces it with the
 * pinned drive): what a drive is, a way to help now, and how drives work.
 */
export function NoDrivesCard({ hasGaps }: { readonly hasGaps: boolean }) {
  return (
    <section
      id="drives"
      aria-labelledby="drives-heading"
      className="flex flex-wrap items-center"
      style={{
        background: T.bg.deep,
        border: `1px solid ${T.border.line}`,
        borderRadius: 28,
        padding: "clamp(22px,3vw,36px)",
        gap: "20px 32px",
      }}
    >
      <div
        className="flex min-w-0 flex-col gap-3.5"
        style={{ flex: "1 1 340px" }}
      >
        <span
          aria-hidden="true"
          className="flex size-[52px] items-center justify-center rounded-full"
          style={{ background: T.accent.chip, color: T.accent.primary }}
        >
          <Icon height={24} icon="mdi:pin-outline" width={24} />
        </span>
        <h2
          id="drives-heading"
          className="m-0"
          style={{
            fontFamily: T.font.serif,
            fontWeight: 500,
            fontSize: "clamp(32px,3.4vw,44px)",
            lineHeight: 1.05,
            color: T.ink.base,
          }}
        >
          No drives are open yet
        </h2>
        <p
          className="m-0 max-w-[56ch] text-[17px] leading-[1.6]"
          style={{ color: T.ink.dim }}
        >
          A drive is a short, shared push to fill one kind of gap, like opening
          hours for a county’s libraries. Until one opens, you can improve any
          record{hasGaps ? ", or work on the gaps below." : "."}
        </p>
        <div className="mt-1 flex flex-wrap gap-2.5">
          <GlobalLink
            href="/contribute/index"
            className="inline-flex min-h-11 items-center rounded-full bg-(--t-accent-primary) px-[22px] py-3 text-[16px] font-semibold text-white no-underline hover:bg-(--t-accent-primary-hover)"
          >
            Improve a record
          </GlobalLink>
        </div>
      </div>

      <ol
        aria-label="How a drive works"
        className="m-0 flex min-w-0 list-none flex-col gap-3"
        style={{
          flex: "1 1 260px",
          padding: "18px 20px",
          background: T.bg.surface,
          border: `1px solid ${T.border.divider}`,
          borderRadius: 20,
        }}
      >
        {DRIVE_STEPS.map((step, i) => (
          <li key={step.title} className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="flex size-7 shrink-0 items-center justify-center rounded-full text-[14px] font-bold"
              style={{
                background: T.accent.chip,
                color: T.accent.primaryHover,
              }}
            >
              {i + 1}
            </span>
            <span className="flex flex-col gap-0.5">
              <strong className="text-[16px]" style={{ color: T.ink.base }}>
                {step.title}
              </strong>
              <span
                className="text-[15px] leading-[1.45]"
                style={{ color: T.ink.dim }}
              >
                {step.text}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
