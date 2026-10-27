"use client"

import { T } from "@/lib/design-tokens"

/**
 * A row of filter chips with counts, for a list of contributions. Each chip
 * is a toggle button; the group is named by its legend.
 */
export function ContributionFilters<Id extends string>({
  legend,
  options,
  active,
  counts,
  onChange,
}: {
  legend: string
  options: readonly { id: Id; label: string }[]
  active: Id
  counts: Record<Id, number>
  onChange: (id: Id) => void
}) {
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="sr-only">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const on = active === option.id

          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(option.id)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors"
              style={
                on
                  ? {
                      background: T.accent.chip,
                      borderColor: T.accent.primary,
                      color: T.accent.primaryHover,
                    }
                  : {
                      background: T.bg.deep,
                      borderColor: T.border.hi,
                      color: T.ink.base,
                    }
              }
            >
              {option.label}
              <span
                className="text-sm font-medium"
                style={{ color: on ? T.accent.primaryHover : T.ink.low }}
              >
                {counts[option.id]}
              </span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
