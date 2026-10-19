// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest"

import { cleanup, render, screen } from "@/test/render"

import { StatusCard } from "../ArticleSidebar"

vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/lib/meilisearch", () => ({ searchLibraryNames: vi.fn() }))
vi.mock("@/lib/navigation", () => ({
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}))
afterEach(cleanup)
it("explains missing requirements and switches to the submission action when ready", () => {
  const props = {
    mode: "new" as const,
    kind: "journal" as const,
    translating: false,
    localeName: "English",
    saveState: "idle" as const,
    lastSavedAt: null,
    submitState: "idle" as const,
    submitError: null,
    publishesDirectly: false,
    onSubmit: vi.fn(),
  }
  const checks = [
    { id: "title", label: "A title", done: true },
    { id: "body", label: "Some text in the body", done: false },
  ]
  const view = render(
    <StatusCard {...props} checks={checks} canSubmit={false} />
  )
  expect(screen.getByRole("list", { name: "Before you submit" })).toBeTruthy()
  expect(
    (
      screen.getByRole("button", {
        name: "1 thing left to submit",
      }) as HTMLButtonElement
    ).disabled
  ).toBe(true)
  view.rerender(
    <StatusCard
      {...props}
      checks={checks.map((check) => ({ ...check, done: true }))}
      canSubmit
    />
  )
  expect(
    (
      screen.getByRole("button", {
        name: "Submit for review",
      }) as HTMLButtonElement
    ).disabled
  ).toBe(false)
})
