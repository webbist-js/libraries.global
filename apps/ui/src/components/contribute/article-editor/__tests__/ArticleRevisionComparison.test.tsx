// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest"

import { cleanup, fireEvent, render, screen, within } from "@/test/render"

import { EMPTY_DOC } from "../article.types"
import { ArticleRevisionComparison } from "../ArticleRevisionComparison"

vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/lib/env-vars", () => ({ getEnvVar: () => {} }))

afterEach(cleanup)

const draft = {
  title: "Mon article",
  summary: "My translated summary",
  doc: EMPTY_DOC,
  sections: ["getting-started"],
  tags: [],
  editSummary: "Translated the guide",
}
const published = {
  ...draft,
  title: "My article",
  summary: "The published summary",
  revision: "published-revision",
  locale: "en",
}

it("keeps published and draft text in separately named, keyboard-scrollable panes", () => {
  const onAdopt = vi.fn()
  const onBack = vi.fn()
  render(
    <ArticleRevisionComparison
      kind="knowledge"
      draft={draft}
      draftLocale="fr"
      published={published}
      busy={false}
      onAdopt={onAdopt}
      onBack={onBack}
    />
  )

  const source = screen.getByRole("region", {
    name: "Published version (English)",
  })
  const translation = screen.getByRole("region", { name: "Your draft" })
  expect(source.getAttribute("tabindex")).toBe("0")
  expect(translation.getAttribute("tabindex")).toBe("0")
  expect(source.getAttribute("lang")).toBe("en")
  expect(translation.getAttribute("lang")).toBe("fr")
  expect(within(source).getByText("My article")).toBeTruthy()
  expect(within(translation).getByText("Mon article")).toBeTruthy()
  expect(
    translation.querySelector("[contenteditable], textarea, input")
  ).toBeNull()
  expect(document.activeElement).toBe(
    screen.getByRole("heading", { name: "What differs" })
  )
  expect(screen.getByText("Title")).toBeTruthy()
  expect(screen.getByText("Summary")).toBeTruthy()
  expect(onAdopt).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole("button", { name: "Back to my draft" }))
  expect(onBack).toHaveBeenCalledOnce()
  expect(onAdopt).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: /I have compared/ }))
  expect(onAdopt).toHaveBeenCalledOnce()
})

it("prevents comparison actions during the audited adoption save", () => {
  const onAdopt = vi.fn()
  const onBack = vi.fn()
  render(
    <ArticleRevisionComparison
      kind="journal"
      draft={draft}
      published={published}
      busy
      onAdopt={onAdopt}
      onBack={onBack}
    />
  )
  fireEvent.click(screen.getByRole("button", { name: /I have compared/ }))
  fireEvent.click(screen.getByRole("button", { name: "Back to my draft" }))
  expect(onAdopt).not.toHaveBeenCalled()
  expect(onBack).not.toHaveBeenCalled()
})
