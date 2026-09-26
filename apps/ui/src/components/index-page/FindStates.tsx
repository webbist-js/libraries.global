// apps/ui/src/components/index-page/FindStates.tsx
"use client"

import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

export function FindSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading results"
      className="grid gap-[18px]"
      style={{
        gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 270px), 1fr))",
      }}
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="animate-pulse overflow-hidden"
          style={{
            background: T.bg.deep,
            border: `1px solid ${T.border.line}`,
            borderRadius: 20,
          }}
        >
          <div className="p-2">
            <div
              className="h-[150px]"
              style={{ background: T.bg.muted, borderRadius: 14 }}
            />
          </div>
          <div className="flex flex-col gap-2.5 px-[18px] pt-1 pb-[18px]">
            <div
              className="h-6 w-3/4 rounded-md"
              style={{ background: T.bg.muted }}
            />
            <div
              className="h-4 w-1/2 rounded-md"
              style={{ background: T.bg.muted }}
            />
            <div className="flex gap-1.5">
              <div
                className="h-6 w-20 rounded-full"
                style={{ background: T.bg.muted }}
              />
              <div
                className="h-6 w-24 rounded-full"
                style={{ background: T.bg.muted }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function FindErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 p-7"
      style={{
        background: "var(--tint-special-bg)",
        borderRadius: 20,
        color: "var(--tint-special-fg)",
      }}
    >
      <p className="m-0 flex items-center gap-2 text-[19px] font-bold">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M12 9v4M12 17h.01" />
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
        </svg>
        We couldn&rsquo;t load libraries just now.
      </p>
      <p className="m-0 text-[16px]" style={{ color: T.ink.base }}>
        The search service may be starting up or unreachable. Your filters are
        kept — try again in a moment.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="cursor-pointer rounded-full border-0 px-5 py-2.5 text-[15px] font-semibold text-white"
        style={{ background: T.ink.base }}
      >
        Try again
      </button>
    </div>
  )
}

export function FindEmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div
      className="flex flex-col items-center gap-4 px-7 py-14 text-center"
      style={{
        background: T.bg.deep,
        border: `1px solid ${T.border.line}`,
        borderRadius: 24,
      }}
    >
      <span
        className="flex size-14 items-center justify-center rounded-full"
        style={{ background: T.accent.chip }}
        aria-hidden="true"
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke={T.accent.primary}
          strokeWidth="1.7"
          strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5M8 11h6" />
        </svg>
      </span>
      <h3
        className="m-0"
        style={{ fontFamily: T.font.serif, fontSize: 32, fontWeight: 500 }}
      >
        No libraries match these filters
      </h3>
      <p className="m-0 max-w-[46ch] text-[17px]" style={{ color: T.ink.dim }}>
        Try removing a filter or two — or help the index grow by adding a
        library you know about.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={onClear}
          className="cursor-pointer rounded-full border-0 px-5 py-2.5 text-[15px] font-semibold text-white"
          style={{ background: T.ink.base }}
        >
          Clear filters
        </button>
        <Link
          href="/contribute"
          className="rounded-full px-5 py-2.5 text-[15px] font-semibold no-underline"
          style={{
            background: T.bg.deep,
            border: `1px solid ${T.border.hi}`,
            color: T.ink.base,
          }}
        >
          Add a missing library
        </Link>
      </div>
    </div>
  )
}
