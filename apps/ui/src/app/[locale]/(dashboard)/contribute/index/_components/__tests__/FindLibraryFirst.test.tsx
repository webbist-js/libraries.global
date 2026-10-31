// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest"

import { cleanup, fireEvent, render, screen, waitFor } from "@/test/render"

import { FindLibraryFirst } from "../FindLibraryFirst"

const mocks = vi.hoisted(() => ({ search: vi.fn() }))
vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/lib/meilisearch", () => ({
  searchLibraryNames: mocks.search,
  buildLibraryPath: () => null,
}))
vi.mock("@/lib/navigation", () => ({
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
it("never presents a failed search as a missing library, and enables adding only after a successful check", async () => {
  mocks.search
    .mockRejectedValueOnce(new Error("Offline"))
    .mockResolvedValueOnce({ hits: [] })
  render(<FindLibraryFirst needsHelp={[]} />)
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "Glasgow" },
  })
  await screen.findByText("We couldn’t search the index")
  expect(screen.queryByText("No matching library found")).toBeNull()
  expect(
    screen
      .getByRole("link", { name: "Add a new library" })
      .getAttribute("aria-disabled")
  ).toBe("true")
  fireEvent.click(screen.getByRole("button", { name: "Try again" }))
  await screen.findByText("No matching library found")
  expect(
    screen
      .getByRole("link", { name: "Add a new library" })
      .getAttribute("aria-disabled")
  ).toBe("false")
  expect(
    screen.getByRole("link", { name: "Add a new library" }).getAttribute("href")
  ).toBe("/contribute/index/new?name=Glasgow")
})
it("ignores an older request after the search is cleared", async () => {
  let resolve!: (result: unknown) => void
  mocks.search.mockReturnValue(
    new Promise((done) => {
      resolve = done
    })
  )
  render(<FindLibraryFirst needsHelp={[]} />)
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "Old library" },
  })
  await waitFor(() => expect(mocks.search).toHaveBeenCalled())
  fireEvent.click(screen.getByRole("button", { name: "Clear search" }))
  resolve({ hits: [{ id: "old", name: "Old result", slug: "old" }] })
  await waitFor(() => expect(screen.queryByText("Old result")).toBeNull())
  expect(
    screen
      .getByRole("link", { name: "Add a new library" })
      .getAttribute("aria-disabled")
  ).toBe("true")
})
