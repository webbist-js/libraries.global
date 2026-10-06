"use client"

import { Icon } from "@iconify/react"
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
}: {
  readonly task: DriveTask
  /** The action, e.g. "Add hours". */
  readonly verb: string
  readonly selected: boolean
  readonly inReview: boolean
  /** Someone else currently holds this library in this drive. */
  readonly heldByOther?: boolean
  readonly onSelect: (task: DriveTask) => void
}) {
  const id = useId()
  const place = taskPlace(task)
  const disabled = inReview || heldByOther
  const statusId = `${id}-status`
  const placeId = `${id}-place`
  const described = [place ? placeId : null, disabled ? statusId : null]
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
        aria-disabled={disabled || undefined}
        aria-describedby={described || undefined}
        onClick={() => {
          if (!disabled) onSelect(task)
        }}
        className={`flex w-full items-center gap-3 rounded-[16px] border px-4 py-3 text-left transition-colors ${
          disabled
            ? "cursor-default"
            : selected
              ? ""
              : "hover:border-(--t-border-hi) hover:bg-(--t-bg-surface)"
        }`}
        style={{
          background: selected ? T.accent.chip : T.bg.deep,
          borderColor: selected ? T.accent.primary : T.border.line,
          borderWidth: selected ? 2 : 1,
          color: T.ink.base,
        }}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[16px] leading-[1.3] font-semibold">
            {task.name}
          </span>
          {place || task.distanceKm != null ? (
            <span
              id={placeId}
              className="text-[14.5px]"
              style={{ color: T.ink.dim }}
            >
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
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[14px] font-semibold"
            style={{ background: "var(--tint-public-bg)", color: T.accent.ok }}
          >
            <Icon
              aria-hidden="true"
              height={15}
              icon="mdi:clock-check-outline"
              width={15}
            />
            <span id={statusId}>In review</span>
          </span>
        ) : heldByOther ? (
          <span
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[14px] font-semibold"
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
            className="inline-flex shrink-0 items-center gap-1 text-[14px] font-semibold"
            style={{ color: T.accent.primary }}
          >
            {verb}
            <Icon height={16} icon="mdi:chevron-right" width={16} />
          </span>
        )}
      </button>
    </li>
  )
}
