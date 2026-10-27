import { T } from "@/lib/design-tokens"

/** What happens to a proposal, for the propose page's hero. */
export const PROPOSE_FLOW = [
  "You propose",
  "A moderator reviews",
  "It opens on the noticeboard",
] as const

/** What happens to a board member's new drive. */
export const BOARD_FLOW = [
  "You create it",
  "It’s scheduled",
  "Open it from its page",
] as const

/**
 * The drive builder's hero steps: numbered pills in a row that wraps,
 * each number in the small indigo chip. An ordered list, so the order is
 * read out too.
 */
export function DriveFlowPills({
  steps,
  label = "What happens next",
}: {
  readonly steps: readonly string[]
  readonly label?: string
}) {
  return (
    <ol aria-label={label} className="m-0 flex list-none flex-wrap gap-2 p-0">
      {steps.map((step, i) => (
        <li
          key={step}
          className="inline-flex items-center gap-2 rounded-full border py-1.5 pr-3.5 pl-1.5 text-sm font-semibold"
          style={{
            background: T.bg.deep,
            borderColor: T.border.line,
            color: T.ink.base,
          }}
        >
          <span
            aria-hidden="true"
            className="flex size-6 items-center justify-center rounded-full text-xs font-bold"
            style={{ background: T.accent.chip, color: T.accent.primaryHover }}
          >
            {i + 1}
          </span>
          {step}
        </li>
      ))}
    </ol>
  )
}
