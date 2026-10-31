// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import type { ReactNode } from "react"
import { afterEach, expect, it, vi } from "vitest"

import { DirectoryPagination } from "@/components/networks/DirectoryPagination"

import { IndexPager } from "../IndexPager"
import { PaginationControls } from "../PaginationControls"

import en from "../../../../locales/en.json"
import fr from "../../../../locales/fr.json"

vi.mock("@/lib/navigation", () => ({
  Link: ({ children, ...props }: React.ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
}))
afterEach(cleanup)
const provider = (children: ReactNode, locale: "en" | "fr" = "en") => (
  <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : fr}>
    {children}
  </NextIntlClientProvider>
)

it("preserves one- and zero-based callback contracts and their single-page hiding rules", () => {
  const one = vi.fn(),
    zero = vi.fn()
  const view = render(
    provider(<IndexPager page={1} totalPages={12} onPageChange={one} />)
  )
  fireEvent.click(screen.getByRole("button", { name: "Next page" }))
  expect(one).toHaveBeenCalledWith(2)
  expect(
    (screen.getByRole("button", { name: "Previous page" }) as HTMLButtonElement)
      .disabled
  ).toBe(true)
  view.rerender(
    provider(<IndexPager page={1} totalPages={1} onPageChange={one} />)
  )
  expect(screen.queryByRole("navigation")).toBeNull()
  view.rerender(
    provider(<PaginationControls page={0} pageCount={12} onPage={zero} />)
  )
  fireEvent.click(screen.getByRole("button", { name: "Next page" }))
  expect(zero).toHaveBeenCalledWith(1)
  view.rerender(
    provider(<PaginationControls page={0} pageCount={1} onPage={zero} />)
  )
  expect(screen.getByRole("navigation")).toBeTruthy()
})
it("keeps first/last and current state reachable and disables pending navigation", () => {
  const onPage = vi.fn()
  render(
    provider(
      <PaginationControls
        page={5}
        pageCount={100000}
        onPage={onPage}
        disabled
      />
    )
  )
  expect(
    screen.getByRole("button", { name: "Page 6" }).getAttribute("aria-current")
  ).toBe("page")
  expect(screen.getByRole("button", { name: "Page 100000" })).toBeTruthy()
  for (const button of screen.getAllByRole("button")) fireEvent.click(button)
  expect(onPage).not.toHaveBeenCalled()
  expect(screen.getAllByRole("button").length).toBeLessThan(10)
})
it("translates visible link pagination and preserves all query filters", () => {
  render(
    provider(
      <DirectoryPagination
        basePath="/library-networks"
        query={new URLSearchParams("kind=service&q=North&page=2")}
        page={2}
        pageSize={10}
        total={35}
        label="Network pages"
      />,
      "fr"
    )
  )
  const links = screen.getAllByRole("link")
  expect(links[0]?.textContent).toContain("Précédent")
  expect(links[1]?.getAttribute("href")).toContain(
    "kind=service&q=North&page=3"
  )
  expect(screen.getByText("Page 2 sur 4")).toBeTruthy()
})
