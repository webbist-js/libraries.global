"use client"

import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"
import { useId } from "react"

import { T } from "@/lib/design-tokens"
import type { DriveTask } from "@/lib/drives/types"

import { taskActionName, taskPlace } from "./task-panel.logic"

/** "850 m away", "1.2 km away". */
function distanceLabel(km: number): string {
  return km < 1
    ? `${Math.round(km * 1000)} m away`
    : `${km.toFixed(km < 10 ? 1 : 0)} km away`
}

/**
 * One library in a drive's task list: a button named for its action ("Add
 * hours for Worthington Libraries, Northwest"), pressed while it's the one
 * in the panel. Once sent it reads "In review" (icon and text) and can't be
 * picked again. Held by someone else, it reads "Someone’s on this" and is
 * disabled the same way.
 */
export function DriveTaskRow({
  task,
  verb,
  selected,
  inReview,
  heldByOther = false,
  onSelect,
  icon = "mdi:clock-outline",
}: {
  readonly task: DriveTask
  /** The action, e.g. "Add hours". */
  readonly verb: string
  readonly selected: boolean
  readonly inReview: boolean
  /** Someone else currently holds this library in this drive. */
  readonly heldByOther?: boolean
  readonly onSelect: (task: DriveTask) => void
  readonly icon?: string
}) {
  const tUi = useUiTranslations("ui")

  const id = useId()
  const place =
    task.city && task.area_name
      ? [...new Set([task.city, task.area_name])].join(", ")
      : taskPlace(task)
  const disabled = inReview || heldByOther
  const statusId = `${id}-status`
  const placeId = `${id}-place`
  const described = [
    place || task.distanceKm != null ? placeId : null,
    disabled ? statusId : null,
  ]
    .filter(Boolean)
    .join(" ")
  const label = heldByOther
    ? `${taskActionName(verb, task.name)}: someone’s on this`
    : taskActionName(verb, task.name)

  return (
    <li>
      <button
        type="button"
        aria-label={label}
        aria-pressed={selected}
        aria-haspopup="dialog"
        aria-disabled={disabled || undefined}
        aria-describedby={described || undefined}
        onClick={() => {
          if (!disabled) onSelect(task)
        }}
        className={`flex min-h-14 w-full items-center gap-3 px-3.5 py-2 text-left transition-colors ${
          disabled
            ? "cursor-default"
            : selected
              ? ""
              : "hover:border-(--t-border-hi) hover:bg-(--t-bg-surface)"
        }`}
        style={{
          background: selected ? T.accent.chip : T.bg.deep,
          boxShadow: selected
            ? `inset 0 0 0 1px ${T.accent.primary}`
            : undefined,
          color: T.ink.base,
        }}
      >
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-(--t-bg-muted) text-(--t-ink-dim)"
        >
          <Icon icon={icon} width={16} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm leading-[1.3] font-semibold">
            {task.name}
          </span>
          {place || task.distanceKm != null ? (
            <span id={placeId} className="text-xs" style={{ color: T.ink.dim }}>
              {place ? <span>{place}</span> : null}
              {place && task.distanceKm != null ? " · " : null}
              {task.distanceKm == null ? null : (
                <span>{distanceLabel(task.distanceKm)}</span>
              )}
            </span>
          ) : null}
        </span>
        {inReview ? (
          <span
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
            style={{ background: "var(--tint-public-bg)", color: T.accent.ok }}
          >
            <Icon
              aria-hidden="true"
              height={15}
              icon="mdi:clock-check-outline"
              width={15}
            />
            <span id={statusId}>{tUi("in_review")}</span>
          </span>
        ) : heldByOther ? (
          <span
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
            style={{ background: T.bg.muted, color: T.ink.dim }}
          >
            <Icon
              aria-hidden="true"
              height={15}
              icon="mdi:account-clock-outline"
              width={15}
            />
            <span id={statusId}>Someone’s on this</span>
          </span>
        ) : (
          <span
            aria-hidden="true"
            className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full border border-(--t-border-hi) bg-white px-3 text-xs font-semibold"
            style={{ color: T.ink.base }}
          >
            {verb}
          </span>
        )}
      </button>
    </li>
  )
}
