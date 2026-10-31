// @vitest-environment happy-dom
import type { ReactNode } from "react"
import { afterEach, expect, it, vi } from "vitest"

import { cleanup, render, screen } from "@/test/render"

import { HomeFooter } from "../HomeFooter"

vi.mock("@/components/global/GlobalLink", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))
vi.mock("@/components/global/footer-navigation", () => ({
  buildFooterNavigation: () => ({
    links: [{ key: "privacy", href: "/legal/privacy", label: "Privacy" }],
    sections: [
      {
        key: "project",
        title: "Project",
        links: [
          ["https://github.com/example/project", "Source"],
          ["/knowledge/methodology", "Methodology"],
          ["https://github.com.example.test/project", "Lookalike host"],
          ["https://example.test/?next=github.com", "Query reference"],
          ["https://[invalid", "Invalid URL"],
        ].map(([href, label]) => ({ key: label, href, label })),
      },
    ],
  }),
}))

afterEach(cleanup)

it("keeps project and policy links without accepting a GitHub substring as a hostname", () => {
  render(<HomeFooter footer={null} legalDocuments={[]} />)
  expect(
    screen.getByRole("link", { name: "Privacy" }).getAttribute("href")
  ).toBe("/legal/privacy")
  expect(
    screen.getByRole("link", { name: "Source" }).getAttribute("href")
  ).toBe("https://github.com/example/project")
  expect(
    screen.getByRole("link", { name: "Methodology" }).getAttribute("href")
  ).toBe("/knowledge/methodology")
  for (const name of ["Lookalike host", "Query reference", "Invalid URL"])
    expect(screen.queryByRole("link", { name })).toBeNull()
})
