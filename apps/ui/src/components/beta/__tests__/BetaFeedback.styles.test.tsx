// @vitest-environment happy-dom
import { readFileSync } from "node:fs"
import path from "node:path"

import tailwind from "@tailwindcss/postcss"
import postcss from "postcss"
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest"

import { cleanup, render, screen } from "@/test/render"

import { BetaFeedback } from "../BetaFeedback"

vi.mock("next/navigation", () => ({ usePathname: () => "/" }))

let styles: HTMLStyleElement

beforeAll(async () => {
  render(<BetaFeedback label="Feedback" />)
  const button = screen.getByRole("button", { name: "Feedback" })
  const candidates = `${button.className} ${button.querySelector("span")!.className}`
  cleanup()

  // Exercise the production optimizer: its removal of rotate/translate resets
  // beside transform:none is what made the live horizontal button upside down.
  const compiled = await postcss([tailwind({ optimize: true })]).process(
    `@import "tailwindcss" source(none); @source inline("${candidates}");\n` +
      readFileSync(path.resolve("src/styles/dashboard.css"), "utf8"),
    { from: path.resolve("src/styles/feedback-regression.css") }
  )
  const css = postcss.parse(compiled.css)
  // Happy DOM does not implement cascade layers. For this fixture the utility
  // selectors are less specific than every unlayered feedback override, so
  // unwrapping layers preserves the relevant cascade.
  css.walkAtRules("layer", (rule) => {
    if (rule.nodes) rule.replaceWith(...rule.nodes)
    else rule.remove()
  })
  styles = document.createElement("style")
  styles.textContent = css.toString()
  document.head.append(styles)
})

afterEach(() => {
  cleanup()
  delete document.body.dataset.dashboardActive
})

afterAll(() => styles.remove())

it("keeps the dashboard label upright after production CSS optimization", () => {
  document.body.dataset.dashboardActive = ""
  render(<BetaFeedback label="Feedback" />)
  const label = screen
    .getByRole("button", { name: "Feedback" })
    .querySelector("span")!
  expect(["", "none", "0deg"]).toContain(
    getComputedStyle(label).getPropertyValue("rotate")
  )
  expect(getComputedStyle(label).getPropertyValue("writing-mode")).toBe(
    "horizontal-tb"
  )
})

it("does not shift the dashboard button halfway above its top inset", () => {
  document.body.dataset.dashboardActive = ""
  render(<BetaFeedback label="Feedback" />)
  const button = screen.getByRole("button", { name: "Feedback" })
  expect(["", "none", "0px", "0px 0px"]).toContain(
    getComputedStyle(button).getPropertyValue("translate")
  )
  expect(getComputedStyle(button).top).toBe("8px")
})

it("retains the vertical edge tab outside the dashboard", () => {
  render(<BetaFeedback label="Feedback" />)
  const button = screen.getByRole("button", { name: "Feedback" })
  expect(
    getComputedStyle(button.querySelector("span")!).getPropertyValue("rotate")
  ).toBe("180deg")
  expect(
    getComputedStyle(button.querySelector("span")!).getPropertyValue(
      "writing-mode"
    )
  ).toBe("vertical-rl")
})
