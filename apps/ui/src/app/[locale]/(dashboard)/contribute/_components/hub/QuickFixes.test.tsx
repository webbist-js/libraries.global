// @vitest-environment happy-dom
import type { AnchorHTMLAttributes } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { WizardLibrary } from "@/components/contribute/wizard.logic"
import { cleanup, fireEvent, render, screen, waitFor } from "@/test/render"

import { QuickFixes } from "./QuickFixes"

vi.mock("@/components/contribute/ContributionWizard", () => ({
  ContributionWizard: ({
    action,
    initialLibrary,
    returnTo,
  }: {
    action: string
    initialLibrary: WizardLibrary
    returnTo: (library: WizardLibrary) => string
  }) => <a href={returnTo(initialLibrary)}>Sign in to continue {action}</a>,
}))
vi.mock("@/lib/navigation", () => ({
  Link: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} />,
}))
const record = {
  documentId: "library",
  slug: "library",
  name: "Library",
  place: "Town",
  percent: 50,
  missing: ["Photo"],
}
afterEach(cleanup)

describe("Quick fix states", () => {
  it("keeps a photo task and its sign-in return path in photo mode", () => {
    render(<QuickFixes records={[record]} />)
    fireEvent.click(screen.getByRole("button", { name: "Add a detail" }))
    expect(
      screen
        .getByRole("link", { name: "Sign in to continue photo" })
        .getAttribute("href")
    ).toContain("action=photo")
    expect(document.activeElement?.id).toBe("quick-fix-editor")
    fireEvent.click(screen.getByRole("button", { name: "Close editor" }))
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Add a detail" })
    )
  })
  it("explains an exhausted task list and lets keyboard users bring suggestions back", async () => {
    render(<QuickFixes records={[record]} />)
    fireEvent.click(screen.getByRole("button", { name: "Skip" }))
    const restore = screen.getByRole("button", {
      name: "Show skipped suggestions",
    })
    expect(screen.getByRole("status").textContent).toContain("You’ve skipped")
    await waitFor(() => expect(document.activeElement).toBe(restore))
    fireEvent.click(restore)
    expect(screen.getByRole("button", { name: "Add a detail" })).toBeTruthy()
  })
  it("does not claim that the index is complete when no opportunities are available", () => {
    render(<QuickFixes records={[]} />)
    expect(screen.queryByRole("heading")).toBeNull()
  })
})
