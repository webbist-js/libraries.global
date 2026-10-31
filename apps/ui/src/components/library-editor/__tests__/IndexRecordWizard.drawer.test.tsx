// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import { act, cleanup, fireEvent, render, screen, waitFor } from "@/test/render"

import { PublishedRecordChangedError } from "../wizard.resume"
import { EMPTY_FORM, type StepProps } from "../wizard.types"

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  save: vi.fn(),
  finalize: vi.fn(),
  push: vi.fn(),
}))
vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/lib/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: mocks.push }),
}))
vi.mock("@/hooks/useSubmissions", () => ({
  useCreateSubmission: () => ({ mutate: mocks.create, isPending: false }),
  useSaveDraft: () => ({ mutate: mocks.save }),
  useFinalizeDraft: () => ({ mutate: mocks.finalize, isPending: false }),
  useResumeDraft: () => ({ data: undefined }),
}))
vi.mock("@/components/library-editor/WizardSteps", () => ({
  STEP_COMPONENTS: Array.from({ length: 7 }, () => ({ f, set }: StepProps) => (
    <label>
      Name
      <input
        value={f.name}
        onChange={(event) => set("name", event.target.value)}
      />
    </label>
  )),
}))
vi.mock("@/components/library/LibraryContributionReview", () => ({
  LibraryContributionReview: () => null,
}))
const { IndexRecordWizard } = await import("../IndexRecordWizard")
const initial = {
  ...EMPTY_FORM,
  name: "Library",
  libraryType: "Public",
  operationalStatus: "open",
  city: "City",
  country: "country",
  editSummary: "Correct the name",
  evidenceType: "institutional_url",
  evidenceUrl: "https://example.org",
}
const submission = {
  documentId: "draft-one",
  status: "pending",
  targetSlug: "library",
  submissionType: "correction",
  updatedAt: "2026-10-30T12:00:00Z",
}
let failSave = false
let acknowledge: (() => void) | null = null
beforeEach(() => {
  vi.clearAllMocks()
  failSave = false
  acknowledge = null
  mocks.create.mockImplementation((_payload, callbacks) => {
    acknowledge = () => {
      if (failSave) callbacks.onError(new Error("offline"))
      else callbacks.onSuccess({ ...submission, status: "draft" })
      callbacks.onSettled?.()
    }
  })
  mocks.save.mockImplementation((_payload, callbacks) => {
    acknowledge = () => {
      if (failSave) callbacks.onError(new Error("offline"))
      else callbacks.onSuccess()
      callbacks.onSettled?.()
    }
  })
  mocks.finalize.mockImplementation((_payload, callbacks) =>
    callbacks.onSuccess(submission)
  )
})
afterEach(cleanup)
function editor(beforeSubmit?: () => Promise<void>) {
  const sent = vi.fn(),
    state = vi.fn(),
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <IndexRecordWizard
        mode="improve"
        layout="drawer"
        initialStep={7}
        initialData={initial}
        target={{
          documentId: "library-id",
          slug: "library",
          name: "Library",
          entityRef: null,
          isClaimed: false,
          completeSections: [],
        }}
        onSubmitted={sent}
        onDraftState={state}
        beforeSubmit={beforeSubmit}
      />
    </QueryClientProvider>
  )

  return { sent, state, client }
}
it("waits for the latest full draft before finalizing and stays in the drawer", async () => {
  const { sent, client } = editor()
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Updated library" },
  })
  fireEvent.click(screen.getByRole("button", { name: "Submit for review" }))
  expect(mocks.create).toHaveBeenCalledTimes(1)
  expect(mocks.create.mock.calls[0]![0]).toMatchObject({
    asDraft: true,
    draftData: { name: "Updated library", previous: { name: "Library" } },
  })
  expect(mocks.finalize).not.toHaveBeenCalled()
  await act(async () => acknowledge!())
  await waitFor(() => expect(mocks.finalize).toHaveBeenCalledTimes(1))
  expect(mocks.finalize.mock.calls[0]![0]).toMatchObject({
    id: "draft-one",
    formData: { name: "Updated library", previous: { name: "Library" } },
  })
  expect(sent).toHaveBeenCalledWith(submission)
  expect(mocks.push).not.toHaveBeenCalled()
  client.clear()
})
it("keeps the edited value and never finalizes after a failed save", async () => {
  failSave = true
  const { sent, client } = editor()
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Unsaved proposal" },
  })
  fireEvent.click(screen.getByRole("button", { name: "Submit for review" }))
  await act(async () => acknowledge!())
  expect(mocks.finalize).not.toHaveBeenCalled()
  expect(sent).not.toHaveBeenCalled()
  expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe(
    "Unsaved proposal"
  )
  expect(screen.getByRole("button", { name: "Retry saving" })).toBeTruthy()
  client.clear()
})
it("requires explicit comparison before using a newer published baseline", async () => {
  const before = vi.fn().mockRejectedValue(
    new PublishedRecordChangedError({
      ...initial,
      name: "Published name",
      city: "Fresh city",
    })
  )
  const { client } = editor(before)
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "My proposal" },
  })
  fireEvent.click(screen.getByRole("button", { name: "Submit for review" }))
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Compare with the latest record" })
    ).toBeTruthy()
  )
  expect(mocks.finalize).not.toHaveBeenCalled()
  fireEvent.click(
    screen.getByRole("button", { name: "Compare with the latest record" })
  )
  expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe(
    "My proposal"
  )
  before.mockResolvedValue(undefined)
  fireEvent.click(screen.getByRole("button", { name: "Submit for review" }))
  await waitFor(() => expect(acknowledge).not.toBeNull())
  await act(async () => acknowledge!())
  await waitFor(() => expect(mocks.finalize).toHaveBeenCalled())
  expect(mocks.finalize.mock.calls[0]![0].formData.previous.name).toBe(
    "Published name"
  )
  expect(mocks.finalize.mock.calls[0]![0].formData).not.toHaveProperty("city")
  client.clear()
})
