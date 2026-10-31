// @vitest-environment happy-dom
import { createElement as h } from "react"
import { afterEach, expect, it } from "vitest"

import { LibrarySourceCredits } from "@/components/library/LibrarySourceCredits"
import { cleanup, render, screen } from "@/test/render"

afterEach(cleanup)
it("keeps attribution, licence and evidence while refusing unsafe source links", () => {
  const { container } = render(
    h(LibrarySourceCredits, {
      references: [
        {
          dataset: "manual",
          label: "Council register",
          // eslint-disable-next-line sonarjs/code-eval -- Deliberately unsafe fixture; the renderer must never emit it as a link.
          url: "javascript:alert(1)",
          recordId: "ref-12",
          fields: ["name"],
          retrievedAt: "2026-10-27",
        },
      ] as never,
      datasets: [
        {
          key: "manual",
          name: "Council data",
          attribution: "Council open data",
          licence: "CC BY 4.0",
          licenceUrl: "https://example.org/licence",
          sourceUrl: "https://example.org/register",
        },
      ] as never,
      added: "Added 27 Oct 2026",
      formatDate: (value) => value ?? null,
    })
  )
  expect(screen.getByText("Council open data")).toBeTruthy()
  expect(
    screen.getByRole("link", { name: "Council register" }).getAttribute("href")
  ).toBe("https://example.org/register")
  expect(container.querySelector('a[href^="javascript:"]')).toBeNull()
  expect(screen.getByText("ref-12")).toBeTruthy()
  expect(screen.getByText("CC BY 4.0").getAttribute("href")).toBe(
    "https://example.org/licence"
  )
})
