import { Icon } from "@iconify/react"
import { useTranslations } from "next-intl"

import { T } from "@/lib/design-tokens"
import type { Drive } from "@/lib/drives/types"

export function DriveHowToHelp({
  drive,
  onRandom,
  busy = false,
  disabled = false,
}: {
  readonly drive: Drive
  readonly onRandom?: () => void
  readonly busy?: boolean
  readonly disabled?: boolean
}) {
  const t = useTranslations("drivePage")
  const steps = drive.steps.filter((step) => step.text?.trim())
  const hoursOnly =
    drive.focus.kind === "gaps" &&
    drive.focus.gaps.length === 1 &&
    drive.focus.gaps[0] === "hours"
  if (!steps.length && !onRandom) return null

  return (
    <section
      aria-labelledby="drive-steps-heading"
      className="flex flex-col gap-4 rounded-[24px] border border-(--t-border-line) bg-(--t-bg-deep) p-6 sm:p-7"
    >
      <div>
        {hoursOnly ? (
          <p className="m-0 text-[11px] font-bold tracking-wide text-(--t-ink-dim) uppercase">
            {t("timeEstimate")}
          </p>
        ) : null}
        <h2
          id="drive-steps-heading"
          className="m-0 text-[30px] leading-tight font-medium"
          style={{ fontFamily: T.font.serif }}
        >
          {t("howToHelp")}
        </h2>
      </div>
      <ol className="m-0 flex list-none flex-col gap-3.5 p-0">
        {steps.map((step, i) => (
          <li
            key={step.id ?? i}
            className="flex items-start gap-2.5 text-[14px] leading-relaxed text-(--t-ink-dim)"
          >
            <span
              aria-hidden
              className="flex size-6 shrink-0 items-center justify-center rounded-full bg-(--t-accent-chip) text-xs font-bold text-(--t-accent-primary)"
            >
              {i + 1}
            </span>
            <span>{step.text}</span>
          </li>
        ))}
      </ol>
      {onRandom ? (
        <button
          type="button"
          onClick={onRandom}
          disabled={busy || disabled}
          className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-(--t-accent-primary) px-4 py-2 text-[14px] font-semibold text-white hover:bg-(--t-accent-primary-hover) disabled:cursor-wait disabled:opacity-60"
        >
          <Icon aria-hidden icon="mdi:shuffle-variant" width={17} />
          {busy ? t("findingLibrary") : t("giveMeLibrary")}
        </button>
      ) : null}
    </section>
  )
}
