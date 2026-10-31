// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest"

import { AtlasFeedbackButton } from "@/components/atlas/AtlasFeedbackButton"
import { BetaFeedback } from "@/components/beta/BetaFeedback"
import { cleanup, fireEvent, render, screen } from "@/test/render"

import { ContactModalProvider } from "../ContactModalProvider"

const navigation = vi.hoisted(() => ({ pathname: "/libraries" }))
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
}))
vi.mock("next/dynamic", () => ({
  default:
    () =>
    ({
      intent,
      context,
      onClose,
      open,
    }: {
      intent: unknown
      context: unknown
      onClose: () => void
      open: boolean
    }) =>
      open ? (
        <div role="dialog">
          <output data-testid="intent">{JSON.stringify(intent)}</output>
          <output data-testid="context">{JSON.stringify(context)}</output>
          <button onClick={onClose}>Close</button>
        </div>
      ) : null,
}))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  navigation.pathname = "/libraries"
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
it.each([false, true])(
  "opens the feedback button (inline: %s) with the shared modal",
  (inline) => {
    render(
      <ContactModalProvider>
        <BetaFeedback label="Feedback" inline={inline} />
      </ContactModalProvider>
    )
    fireEvent.click(screen.getByRole("button", { name: "Feedback" }))
    expect(JSON.parse(screen.getByTestId("intent").textContent!)).toEqual({
      mode: "feedback",
    })
  }
)

it.each(["/map", "/map/", "/en/map", "/cs/map", "/fr/map/"])(
  "replaces the floating feedback tab on %s with Atlas feedback",
  (pathname) => {
    navigation.pathname = pathname
    render(
      <ContactModalProvider>
        <BetaFeedback label="Floating feedback" />
        <AtlasFeedbackButton />
      </ContactModalProvider>
    )
    expect(
      screen.queryByRole("button", { name: "Floating feedback" })
    ).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Feedback" }))
    expect(JSON.parse(screen.getByTestId("intent").textContent!)).toEqual({
      mode: "feedback",
      product: "atlas",
    })
  }
)

it("keeps the floating feedback tab on other pages", () => {
  navigation.pathname = "/cs/libraries"
  render(
    <ContactModalProvider>
      <BetaFeedback label="Feedback" />
    </ContactModalProvider>
  )
  expect(screen.getByRole("button", { name: "Feedback" })).toBeTruthy()
})
