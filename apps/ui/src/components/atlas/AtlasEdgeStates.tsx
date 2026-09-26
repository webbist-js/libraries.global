"use client"

import { T } from "@/lib/design-tokens"

import { Icon } from "./atlas-ui"
import type { LoosenSuggestion } from "./atlas.logic"

export function AtlasLoading({
  listReady,
  onOpenList,
}: {
  readonly listReady: boolean
  readonly onOpenList: () => void
}) {
  return (
    <div
      className="flex items-center justify-between gap-4 rounded-[18px] border bg-white px-[18px] py-3.5"
      style={{ borderColor: T.border.line }}
      role="status"
    >
      <span className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="size-[22px] animate-spin rounded-full border-[3px] motion-reduce:animate-none"
          style={{
            borderColor: T.accent.chip,
            borderTopColor: T.accent.primary,
          }}
        />
        <span>
          <strong className="block">Loading the map…</strong>
          <span className="text-[14px]" style={{ color: T.ink.dim }}>
            {listReady
              ? "The library list is already available."
              : "Fetching libraries."}
          </span>
        </span>
      </span>
      {listReady ? (
        <button
          type="button"
          onClick={onOpenList}
          className="inline-flex h-9 items-center gap-2 rounded-full border bg-white px-3.5 text-[14px] font-semibold"
          style={{ borderColor: T.border.hi }}
        >
          <Icon name="list" size={15} />
          Open list
        </button>
      ) : null}
    </div>
  )
}

export function AtlasNoMatch({
  filterCount,
  suggestions,
  onApply,
  onClear,
}: {
  readonly filterCount: number
  readonly suggestions: LoosenSuggestion[]
  readonly onApply: (s: LoosenSuggestion) => void
  readonly onClear: () => void
}) {
  return (
    <div
      className="w-[min(440px,calc(100vw-32px))] rounded-[22px] border bg-white p-[22px]"
      style={{ borderColor: T.border.hi }}
      role="status"
    >
      <h2
        className="m-0 text-[26px] leading-tight"
        style={{ fontFamily: T.font.serif, fontWeight: 500 }}
      >
        No libraries match{" "}
        {filterCount === 1 ? "this filter" : `all ${filterCount} filters`}
      </h2>
      <p
        className="mt-2 mb-3.5 text-[15px] leading-normal"
        style={{ color: "#45435A" }}
      >
        {suggestions.length > 0
          ? "Try loosening one. Each suggestion shows how many libraries it would bring back."
          : "Try clearing the filters to see every library."}
      </p>
      <div className="flex flex-col gap-2">
        {suggestions.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => onApply(s)}
            className="flex h-11 items-center justify-between rounded-full border bg-white px-4 text-[14px] font-semibold"
            style={{ borderColor: T.border.hi }}
          >
            {s.label}
            <strong style={{ color: T.accent.ok }}>
              +{s.gain.toLocaleString()}
            </strong>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onClear}
        className="mt-3 text-[14px] font-semibold underline underline-offset-[3px]"
        style={{ color: "#3730A3" }}
      >
        Clear all filters
      </button>
    </div>
  )
}

export function AtlasBanner({
  tone,
  title,
  body,
  action,
}: {
  readonly tone: "danger" | "info"
  readonly title: string
  readonly body: string
  readonly action?: { label: string; onClick: () => void }
}) {
  const danger = tone === "danger"

  return (
    <div
      className="flex items-center gap-3 rounded-[18px] border px-4 py-3.5"
      style={{
        background: danger ? "#F6E3DA" : "#fff",
        borderColor: danger ? "#E4BFAE" : T.border.hi,
        color: danger ? "#5E2A15" : T.ink.base,
      }}
      role={danger ? "alert" : "status"}
    >
      <Icon
        name={danger ? "off" : "info"}
        size={20}
        color={danger ? T.accent.danger : "#28496E"}
      />
      <span className="flex-1 text-[15px] leading-snug">
        <strong>{title}</strong> {body}
      </span>
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className="inline-flex h-9 shrink-0 items-center rounded-full border bg-white px-3.5 text-[14px] font-semibold"
          style={{ borderColor: T.border.hi, color: T.ink.base }}
        >
          {action.label}
        </button>
      ) : null}
    </div>
  )
}

export function AtlasToast({
  children,
  onDismiss,
  action,
}: {
  readonly children: React.ReactNode
  readonly onDismiss: () => void
  readonly action?: { label: string; onClick: () => void }
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-full border bg-white py-2 pr-2.5 pl-4 text-[14px] font-semibold"
      style={{ borderColor: T.border.hi }}
      role="status"
    >
      {children}
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className="text-[14px] font-semibold underline underline-offset-[3px]"
          style={{ color: "#3730A3" }}
        >
          {action.label}
        </button>
      ) : null}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="flex size-8 items-center justify-center rounded-full"
        style={{ color: T.ink.dim }}
      >
        <Icon name="x" size={16} />
      </button>
    </div>
  )
}
