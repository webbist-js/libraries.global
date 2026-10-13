// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

function translate(key: string) {
  return key
}

vi.mock("next-intl", () => ({
  useTranslations: () => translate,
}))

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./dialog"

afterEach(cleanup)

describe("dialog close appearance", () => {
  it("applies icon styling to the built-in close button without affecting close actions", () => {
    render(
      <Dialog defaultOpen>
        <DialogContent closeButtonClassName="icon-dismiss size-11">
          <DialogTitle>Review</DialogTitle>
          <DialogDescription>Review before confirming.</DialogDescription>
          <DialogClose asChild>
            <button type="button">Cancel</button>
          </DialogClose>
        </DialogContent>
      </Dialog>
    )
    const icon = screen.getByRole("button", { name: "close" })
    expect([...document.querySelectorAll(".icon-dismiss")]).toEqual([icon])
    expect(screen.getByRole("button", { name: "Cancel" }).className).toBe("")
    expect(icon.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true")
  })
})
