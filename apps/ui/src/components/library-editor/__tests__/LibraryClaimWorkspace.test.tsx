// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest"

import { act, cleanup, fireEvent, render, screen } from "@/test/render"

import { LibraryClaimWorkspace } from "../LibraryClaimWorkspace"

const mocks = vi.hoisted(() => ({ search: vi.fn(), mutate: vi.fn() }))
vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/lib/meilisearch", () => ({ searchLibraryNames: mocks.search }))
vi.mock("@/hooks/useSubmissions", () => ({
  useCreateSubmission: () => ({ mutate: mocks.mutate, isPending: false }),
}))
vi.mock("@/lib/navigation", () => ({
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

it("finds and claims an imported library in Staff without a public-record detour", async () => {
  mocks.search.mockResolvedValue({
    hits: [
      {
        id: "1",
        documentId: "doc1",
        name: "Central Library",
        slug: "central",
        entityRef: "import:gb:1",
        city: "London",
      },
    ],
  })
  render(<LibraryClaimWorkspace context="staff" />)
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "Central" },
  })
  fireEvent.click(
    await screen.findByRole("button", {
      name: /Claim this library.*Central Library/,
    })
  )
  expect(screen.getByRole("heading", { name: "Central Library" })).toBeTruthy()
  expect(screen.queryByRole("link", { name: /Open its page/ })).toBeNull()
  fireEvent.change(screen.getByLabelText(/Verification details/), {
    target: { value: "Please check the staff page at our institution." },
  })
  const submit = screen.getByRole("button", { name: "Send claim for review" })
  expect((submit as HTMLButtonElement).disabled).toBe(true)
  fireEvent.change(screen.getByLabelText(/Your role/), {
    target: { value: "librarian" },
  })
  fireEvent.click(submit)
  expect(mocks.mutate).toHaveBeenCalledTimes(1)
  expect(mocks.mutate.mock.calls[0]![0]).toEqual({
    submissionType: "library_claim",
    targetEntityType: "library",
    targetDocumentId: "doc1",
    targetSlug: "central",
    note: "Please check the staff page at our institution.",
    fields: {
      name: "Central Library",
      entityRef: "import:gb:1",
      role: "librarian",
      department: undefined,
      verificationMethod: "contact_us",
    },
  })
  expect(
    (
      screen.getByRole("button", {
        name: "Change library",
      }) as HTMLButtonElement
    ).disabled
  ).toBe(true)
  act(() => mocks.mutate.mock.calls[0]![1].onSuccess())
  expect(
    screen.getByRole("heading", { name: "Your claim is with the moderators" })
  ).toBeTruthy()
  expect(
    screen
      .getByRole("link", { name: "Back to Staff area" })
      .getAttribute("href")
  ).toBe("/staff")
})

it("keeps verification details after a failed submission and permits retry", () => {
  mocks.mutate.mockImplementation((_payload, options) =>
    options.onError(new Error("Try again later"))
  )
  render(
    <LibraryClaimWorkspace
      initialLibrary={{
        libraryDocumentId: "doc1",
        librarySlug: "central",
        libraryName: "Central Library",
      }}
    />
  )
  fireEvent.change(screen.getByLabelText(/Your role/), {
    target: { value: "volunteer" },
  })
  fireEvent.change(screen.getByLabelText(/Verification details/), {
    target: { value: "I volunteer in the children's reading room." },
  })
  fireEvent.click(screen.getByRole("button", { name: "Send claim for review" }))
  expect(screen.getByRole("alert").textContent).toContain("Try again later")
  expect(
    (screen.getByLabelText(/Verification details/) as HTMLTextAreaElement).value
  ).toContain("reading room")
  expect(
    (
      screen.getByRole("button", {
        name: "Send claim for review",
      }) as HTMLButtonElement
    ).disabled
  ).toBe(false)
  fireEvent.click(screen.getByRole("button", { name: "Change library" }))
  expect(screen.getByRole("searchbox")).toBeTruthy()
})
