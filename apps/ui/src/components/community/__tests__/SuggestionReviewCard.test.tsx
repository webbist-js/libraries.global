// @vitest-environment happy-dom
import { NextIntlClientProvider } from "next-intl"
import * as React from "react"
import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"

import type { SuggestionReviewRound } from "@/lib/community/suggestions"

import { SuggestionReviewCard } from "../SuggestionReviewCard"

import messages from "../../../../locales/en.json"

Object.assign(globalThis, { React })
describe("suggestion review progress hydration", () => {
  it("serializes a bounded percentage identically before and after browser style parsing", () => {
    const round = {
      state: "voting",
      opensAt: "2026-10-01T00:00:00Z",
      cutoffAt: "2026-11-01T00:00:00Z",
      reviewAt: "2026-11-03T00:00:00Z",
      capacity: 5,
    } as SuggestionReviewRound
    const now = new Date("2026-10-14T02:45:37.894Z")
    const markup = renderToString(
      <NextIntlClientProvider
        locale="en"
        messages={messages}
        timeZone="UTC"
        now={now}
      >
        <SuggestionReviewCard round={round} />
      </NextIntlClientProvider>
    )
    const match = /style="width:([^%]+)%"/.exec(markup)
    expect(match).not.toBeNull()
    expect(match![1]).toMatch(/^\d+(?:\.\d{1,2})?$/)
    const element = document.createElement("div")
    element.innerHTML = markup
    const fill = element.querySelector<HTMLElement>("[role=progressbar] > div")!
    expect(fill.style.width).toBe(`${match![1]}%`)
  })
})
