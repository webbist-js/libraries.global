"use client"

import {
  appendReviewResponse,
  reviewResponses,
  type ReviewResponseContext,
} from "@repo/shared-data"
import { useTranslations } from "next-intl"
import { useId, useState } from "react"

export function ReviewResponsePicker({
  context,
  note,
  onChange,
  disabled = false,
}: {
  readonly context: ReviewResponseContext
  readonly note: string
  readonly onChange: (note: string) => void
  readonly disabled?: boolean
}) {
  const tStatic = useTranslations("staticUi")

  const id = useId()
  const [selected, setSelected] = useState("")
  const responses = reviewResponses(context)
  const response = responses.find((item) => item.id === selected)
  const next = response ? appendReviewResponse(note, response.text) : null

  return (
    <details className="rounded-xl border border-(--t-border-line) p-3 text-sm">
      <summary className="cursor-pointer font-semibold text-(--t-accent-primary)">
        {tStatic("moderation.suggested_responses")}
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        <p className="m-0 text-(--t-ink-dim)">
          {tStatic(
            "moderation.choose_a_starting_point_then_edit_it_to_fit_your_review_nothing_is_sent_until_you_submit_your_decisi"
          )}
        </p>
        <label htmlFor={id} className="font-semibold">
          {tStatic("common.response")}
        </label>
        <select
          id={id}
          value={selected}
          disabled={disabled}
          onChange={(event) => setSelected(event.target.value)}
          className="min-h-11 w-full rounded-xl border border-(--t-border-hi) bg-(--t-bg-deep) px-3 text-(--t-ink-base)"
        >
          <option value="">{tStatic("moderation.choose_a_response")}</option>
          {responses.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        {response && (
          <>
            <p className="m-0 leading-relaxed" aria-live="polite">
              {response.text}
            </p>
            <button
              type="button"
              disabled={disabled || next === null}
              onClick={() => {
                if (next !== null) onChange(next)
              }}
              className="min-h-11 self-start rounded-full border border-(--t-border-hi) px-4 py-2 font-semibold disabled:opacity-50"
            >
              {note.trim() ? "Append to note" : "Use response"}
            </button>
            {next === null && (
              <p role="status" className="m-0 text-(--t-ink-dim)">
                {tStatic(
                  "moderation.shorten_your_note_before_adding_this_response_2_000_characters_maximum"
                )}
              </p>
            )}
          </>
        )}
      </div>
    </details>
  )
}
