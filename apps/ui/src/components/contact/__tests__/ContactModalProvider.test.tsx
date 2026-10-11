// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({ usePathname: () => "/libraries" }))
vi.mock("next/dynamic", () => ({
  default:
    () =>
    ({
      intent,
      context,
      onClose,
    }: {
      intent: unknown
      context: unknown
      onClose: () => void
    }) => (
      <div role="dialog">
        <output data-testid="intent">{JSON.stringify(intent)}</output>
        <output data-testid="context">{JSON.stringify(context)}</output>
        <button onClick={onClose}>Close</button>
      </div>
    ),
}))
import { BetaFeedback } from "@/components/beta/BetaFeedback"

import { ContactModalProvider } from "../ContactModalProvider"

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
it("covers mail links nested in CMS-style content and infers plan inquiries", () => {
  render(
    <ContactModalProvider>
      <a href="mailto:info@libraries.global?subject=Pro%20grant">
        <span>Ask for a grant</span>
      </a>
    </ContactModalProvider>
  )
  fireEvent.click(screen.getByText("Ask for a grant"))
  expect(JSON.parse(screen.getByTestId("intent").textContent!)).toEqual({
    mode: "contact",
    type: "plans",
    sourceSubject: "Pro grant",
  })
  expect(
    JSON.parse(screen.getByTestId("context").textContent!).viewport.width
  ).toBeGreaterThan(0)
})
it("honors a specific purpose and a configured beta alias", () => {
  render(
    <ContactModalProvider aliases={["beta@example.org"]}>
      <a href="mailto:beta@example.org" data-contact-type="report_issue">
        Get help
      </a>
    </ContactModalProvider>
  )
  fireEvent.click(screen.getByText("Get help"))
  expect(JSON.parse(screen.getByTestId("intent").textContent!)).toMatchObject({
    mode: "contact",
    type: "report_issue",
  })
})
it("opens the floating beta button as feedback", () => {
  render(
    <ContactModalProvider>
      <BetaFeedback label="Feedback" />
    </ContactModalProvider>
  )
  fireEvent.click(screen.getByRole("button", { name: "Feedback" }))
  expect(JSON.parse(screen.getByTestId("intent").textContent!)).toEqual({
    mode: "feedback",
  })
})
