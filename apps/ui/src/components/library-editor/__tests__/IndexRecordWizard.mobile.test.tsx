// @vitest-environment happy-dom
import { timetableHash, type MobileTimetable } from "@repo/shared-data"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  cleanup,
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@/test/render"

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  save: vi.fn(),
  timetable: vi.fn(),
  resume: vi.fn(),
}))
vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/lib/env-vars", () => ({ getEnvVar: () => {} }))
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => ({ data: null, isPending: false }) },
}))
vi.mock("@/lib/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  routing: { defaultLocale: "en" },
}))
vi.mock("@/hooks/useSubmissions", () => ({
  useCreateSubmission: () => ({ mutate: mocks.create, isPending: false }),
  useSaveDraft: () => ({ mutate: mocks.save }),
  useFinalizeDraft: () => ({ mutate: vi.fn(), isPending: false }),
  useResumeDraft: () => ({ data: mocks.resume() }),
}))
vi.mock("@/components/mobile/TimetableEditor", () => ({
  TimetableEditor: (props: {
    value: MobileTimetable
    onChange: (tt: MobileTimetable) => void
    noticesBlock: React.ReactNode
  }) => {
    mocks.timetable(props)

    return (
      <>
        <button
          type="button"
          onClick={() =>
            props.onChange({
              ...props.value,
              visits: props.value.visits.map((v) => ({
                ...v,
                arrive: "09:15",
              })),
            })
          }
        >
          Change arrival
        </button>
        {props.noticesBlock}
      </>
    )
  },
}))

vi.mock("../FacilityChecklistRows", () => ({
  FacilityChecklistRows: () => null,
}))
vi.mock("../WizardFields", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  TagSelector: () => null,
}))

const { IndexRecordWizard } = await import("../IndexRecordWizard")
const { wizardStepOf } = await import("../wizard.steps")
const timetable: MobileTimetable = {
  version: 1,
  cycle: { weeks: 1, anchor: "2026-10-05" },
  stops: [
    {
      id: "stop000001",
      name: "Village",
      where: "Green",
      location: { lat: 51, lng: 0 },
      areaDocumentId: null,
    },
  ],
  visits: [
    {
      id: "visit00001",
      stopId: "stop000001",
      day: "mon",
      arrive: "09:00",
      depart: "10:00",
      repeat: { kind: "cycle", weeks: [1] },
      termTimeOnly: false,
      validFrom: null,
      validTo: null,
    },
  ],
}
const initialData = {
  name: "Mobile library",
  libraryType: "Mobile",
  operationalStatus: "open",
  mobileTimetable: timetable,
  country: "United Kingdom",
  regionDocumentId: "region001",
  evidenceType: "website",
  evidenceUrl: "https://example.org/times",
  editSummary: "Updated arrival time",
}
const target = {
  documentId: "library001",
  slug: "mobile-library",
  name: "Mobile library",
  entityRef: null,
  isClaimed: false,
  completeSections: [],
}
const context = { notices: [], timezone: "Europe/London", today: "2026-10-08" }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.create.mockImplementation((_payload, callbacks) => {
    callbacks?.onSuccess?.({ documentId: "draft-local" })
    callbacks?.onSettled?.()
  })
  mocks.save.mockImplementation((_payload, callbacks) => {
    callbacks?.onSuccess?.()
    callbacks?.onSettled?.()
  })
  mocks.resume.mockReturnValue(undefined)
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({ data: [], published: ["mobileTimetable"], requested: [] })
    )
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const setup = (
  mode: "staff" | "improve" | "staff-new" | "new",
  translating = false,
  initialStep: number | null = 3
) =>
  render(
    <IndexRecordWizard
      mode={mode}
      target={target}
      initialData={initialData}
      initialStep={initialStep ?? undefined}
      timetableContext={context}
      locale={{
        code: translating ? "cs" : "en",
        defaultCode: "en",
        languageName: translating ? "Czech" : "English",
      }}
    />
  )

describe("the shared mobile library wizard", () => {
  it("opens health links in Visit for fixed libraries and Visit & access for mobile libraries", () => {
    for (const alias of [
      "links",
      "access",
      "accessibility",
      "facilities",
      "visit",
    ]) {
      expect(wizardStepOf(alias)).toBe(3)
      expect(wizardStepOf(alias, true)).toBe(8)
    }
    expect(wizardStepOf("timetable", true)).toBe(3)
    expect(wizardStepOf("stops", true)).toBe(3)
  })

  it("keeps the fixed library's hours and access together in its seven-step form", () => {
    render(
      <IndexRecordWizard
        mode="improve"
        target={target}
        initialData={{ ...initialData, libraryType: "Public" }}
        initialStep={3}
      />
    )
    expect(screen.getByText("Step 3 of 7 · Visit")).toBeTruthy()
    expect(screen.getByLabelText("Website URL")).toBeTruthy()
    expect(screen.getByLabelText("Accessibility notes")).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Opening hours" })).toBeTruthy()
    expect(
      screen.getByRole("button", { name: "Next: Collections" })
    ).toBeTruthy()
    expect(screen.queryByRole("button", { name: /Visit & access/ })).toBeNull()
    expect(screen.queryByRole("button", { name: "Change arrival" })).toBeNull()
  })

  it.each(["staff", "improve", "staff-new", "new"] as const)(
    "opens the same timetable and mobile step labels in %s mode",
    (mode) => {
      setup(mode)
      expect(
        screen.getByRole("heading", { name: "Where does the vehicle stop?" })
      ).toBeTruthy()
      expect(
        screen.getByRole("button", {
          name: /Base & area/,
          description: /Step 2: Base & area/,
        })
      ).toBeTruthy()
      expect(
        screen
          .getByRole("button", {
            name: /Stops & times/,
            description: /Step 3: Stops & times/,
          })
          .getAttribute("aria-current")
      ).toBe("step")
      expect(mocks.timetable.mock.lastCall?.[0]).toMatchObject({
        value: timetable,
        notices: [],
        timezone: "Europe/London",
      })
      expect(
        screen.getByRole("region", { name: "Service notices" })
      ).toBeTruthy()
      expect(screen.getByText("Step 3 of 8 · Stops & times")).toBeTruthy()
      expect(screen.queryByLabelText("Website URL")).toBeNull()
      expect(screen.queryByLabelText("Phone")).toBeNull()
      expect(screen.queryByLabelText("Accessibility notes")).toBeNull()
      expect(screen.queryByText("Services & amenities")).toBeNull()
      expect(
        screen.getByLabelText("Published timetable page or PDF")
      ).toBeTruthy()
    }
  )

  it.each(["staff", "improve", "staff-new", "new"] as const)(
    "keeps timetable and access edits across Next and Back in %s mode",
    (mode) => {
      setup(mode)
      fireEvent.click(screen.getByRole("button", { name: "Change arrival" }))
      fireEvent.click(
        screen.getByRole("button", { name: "Next: Visit & access" })
      )
      expect(screen.getByText("Step 4 of 8 · Visit & access")).toBeTruthy()
      expect(
        screen.queryByRole("button", { name: "Change arrival" })
      ).toBeNull()
      expect(screen.getByLabelText("Website URL")).toBeTruthy()
      fireEvent.change(screen.getByLabelText("Accessibility notes"), {
        target: { value: "Vehicle has a lift" },
      })
      fireEvent.click(screen.getByRole("button", { name: "Back" }))
      expect(mocks.timetable.mock.lastCall?.[0].value.visits[0].arrive).toBe(
        "09:15"
      )
      fireEvent.click(
        screen.getByRole("button", { name: "Next: Visit & access" })
      )
      expect(
        (screen.getByLabelText(/Accessibility notes/) as HTMLTextAreaElement)
          .value
      ).toBe("Vehicle has a lift")
      fireEvent.click(screen.getByRole("button", { name: "Next: Collections" }))
      expect(screen.getByText("Step 5 of 8 · Collections")).toBeTruthy()
    }
  )

  it.each([
    [3, "Step 4 of 8 · Visit & access"],
    [8, "Step 5 of 8 · Collections"],
  ] as const)(
    "resumes after saved step ID %s in mobile navigation order",
    (stepCompleted, heading) => {
      mocks.resume.mockReturnValue({
        documentId: "draft001",
        draftData: initialData,
        stepCompleted,
        updatedAt: "2026-10-08T09:00:00Z",
      })
      setup("improve", false, null)
      fireEvent.click(screen.getByRole("button", { name: "Continue" }))
      expect(screen.getByText(heading)).toBeTruthy()
    }
  )

  it("publishes a staff timetable with its previous hash through the shared publish controls", async () => {
    setup("staff")
    fireEvent.click(screen.getByRole("button", { name: "Change arrival" }))
    fireEvent.click(
      screen.getByRole("button", { name: "Next: Visit & access" })
    )
    fireEvent.change(screen.getByLabelText("Accessibility notes"), {
      target: { value: "Vehicle has a lift" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Publish changes" }))
    const dialog = screen.getByRole("dialog", { name: "Publish your changes" })
    expect(
      within(dialog).getByRole("heading", { name: "Stops & times" })
    ).toBeTruthy()
    expect(
      within(dialog).getByRole("heading", { name: "Visit & access" })
    ).toBeTruthy()
    expect(within(dialog).getAllByText("Mobile Timetable")).toHaveLength(1)
    expect(within(dialog).getAllByText("Accessibility Notes")).toHaveLength(1)
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Publish changes" })
    )
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/staff/library001/publish",
        expect.objectContaining({ method: "POST" })
      )
    )
    const call = vi
      .mocked(fetch)
      .mock.calls.find(([url]) => url === "/api/staff/library001/publish")!
    const body = JSON.parse(String(call[1]?.body))
    expect(body.previous.mobileTimetable).toBe(timetableHash(timetable))
    expect(body.fields.mobileTimetable.visits[0].arrive).toBe("09:15")
    expect(body.fields.accessibilityNotes).toBe("Vehicle has a lift")
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })

  it("sends contributor timetable changes for review without calling staff publishing", () => {
    setup("improve")
    fireEvent.click(screen.getByRole("button", { name: "Change arrival" }))
    fireEvent.click(
      screen.getByRole("button", {
        name: /Sources & send/,
        description: /Step 8: Sources & send/,
      })
    )
    fireEvent.click(screen.getByRole("button", { name: "Submit for review" }))
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        submissionType: "correction",
        fields: expect.objectContaining({
          previousHash: timetableHash(timetable),
          mobileTimetable: expect.objectContaining({
            visits: [expect.objectContaining({ arrive: "09:15" })],
          }),
        }),
      }),
      expect.anything()
    )
    expect(
      vi
        .mocked(fetch)
        .mock.calls.some(([url]) => String(url).includes("/api/staff/"))
    ).toBe(false)
  })

  it("keeps the timetable read-only when translating", () => {
    setup("staff", true)
    const fieldset = screen
      .getByRole("button", { name: "Change arrival" })
      .closest("fieldset")
    expect(fieldset?.disabled).toBe(true)
  })
})

it("saves within a step, keeps failed edits recoverable, and warns before leaving", async () => {
  mocks.create.mockImplementation((_payload, callbacks) => {
    callbacks.onError(new Error("offline"))
    callbacks.onSettled()
  })
  setup("improve")
  fireEvent.click(screen.getByRole("button", { name: "Change arrival" }))
  await screen.findByRole("button", { name: "Retry saving" }, { timeout: 2000 })
  expect(screen.getByRole("alert").textContent).toContain("could not be saved")
  const leave = new Event("beforeunload", { cancelable: true })
  window.dispatchEvent(leave)
  expect(leave.defaultPrevented).toBe(true)
  mocks.create.mockImplementation((_payload, callbacks) => {
    callbacks.onSuccess({ documentId: "draft-recovered" })
    callbacks.onSettled()
  })
  fireEvent.click(screen.getByRole("button", { name: "Retry saving" }))
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull())
  const savedLeave = new Event("beforeunload", { cancelable: true })
  window.dispatchEvent(savedLeave)
  expect(savedLeave.defaultPrevented).toBe(false)
})

it("serialises draft creation and saves the latest queued edit using the created ID", async () => {
  let pending:
    | {
        onSuccess: (value: { documentId: string }) => void
        onSettled: () => void
      }
    | undefined
  mocks.create.mockImplementation((_payload, callbacks) => {
    pending = callbacks
  })
  setup("improve")
  fireEvent.click(screen.getByRole("button", { name: "Change arrival" }))
  await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce(), {
    timeout: 2000,
  })
  fireEvent.click(screen.getByRole("button", { name: "Next: Visit & access" }))
  fireEvent.change(screen.getByLabelText("Accessibility notes"), {
    target: { value: "Latest queued edit" },
  })
  await act(async () => {
    pending!.onSuccess({ documentId: "single-draft" })
    pending!.onSettled()
  })
  await waitFor(
    () =>
      expect(mocks.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "single-draft",
          draftData: expect.objectContaining({
            accessibilityNotes: "Latest queued edit",
          }),
        }),
        expect.anything()
      ),
    { timeout: 2000 }
  )
  expect(mocks.create).toHaveBeenCalledOnce()
})

it("recovers unsaved Back/Forward work after remounting without exposing it to another account client", () => {
  const clientA = new QueryClient()
  const clientB = new QueryClient()
  const editor = (client: QueryClient) =>
    render(
      <QueryClientProvider client={client}>
        <IndexRecordWizard
          mode="improve"
          target={target}
          initialData={initialData}
          initialStep={3}
          timetableContext={context}
        />
      </QueryClientProvider>
    )
  const first = editor(clientA)
  fireEvent.click(screen.getByRole("button", { name: "Change arrival" }))
  first.unmount()
  const otherAccount = editor(clientB)
  expect(
    screen.queryByRole("heading", { name: "Recover unsaved edits" })
  ).toBeNull()
  otherAccount.unmount()
  editor(clientA)
  expect(
    screen.getByRole("heading", { name: "Recover unsaved edits" })
  ).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Restore edits" }))
  expect(mocks.timetable.mock.lastCall?.[0].value.visits[0].arrive).toBe(
    "09:15"
  )
  expect(
    screen.queryByRole("heading", { name: "Recover unsaved edits" })
  ).toBeNull()
  clientA.clear()
  clientB.clear()
})
