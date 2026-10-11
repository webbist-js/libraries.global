// @vitest-environment happy-dom
import { emptyTimetable, type MobileTimetable } from "@repo/shared-data"
import { useState, type ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
  act,
} from "@/test/render"

const { areaLookup } = vi.hoisted(() => ({ areaLookup: vi.fn() }))
vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("../stop-area", () => ({ areaAtStop: areaLookup }))
vi.mock("@/components/library-editor/LocationLookup", () => ({
  LocationLookup: () => null,
}))
vi.mock("@/components/library-editor/LocationPinMap", () => ({
  LocationPinMap: ({
    onMove,
  }: {
    onMove: (lat: number, lng: number) => void
  }) => (
    <button type="button" onClick={() => onMove(51.5, -0.12)}>
      Move stop pin
    </button>
  ),
}))
vi.mock("@/components/ds", () => ({
  Sheet: ({
    open,
    title,
    children,
    footer,
  }: {
    open: boolean
    title: string
    children: ReactNode
    footer?: ReactNode
  }) =>
    open ? (
      <section aria-label={title}>
        {children}
        {footer}
      </section>
    ) : null,
  Switch: () => null,
  EmptyState: ({ lead, message }: { lead?: string; message?: string }) => (
    <p>{lead ?? message}</p>
  ),
  SegmentedControl: ({
    label,
    options,
    value,
    onChange,
  }: {
    label: string
    options: { value: string; label: string; sub?: string }[]
    value: string
    onChange: (value: string) => void
  }) => (
    <fieldset>
      <legend>{label}</legend>
      {options.map((option) => (
        <label key={option.value}>
          <input
            type="radio"
            name={label}
            value={option.value}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
          />
          {option.label}
          {option.sub ? <span>{option.sub}</span> : null}
        </label>
      ))}
    </fieldset>
  ),
  Notice: ({
    title,
    children,
  }: {
    title?: ReactNode
    children?: ReactNode
  }) => (
    <div role="status">
      {title}
      {children}
    </div>
  ),
}))
import { TimetableEditor } from "../TimetableEditor"

const timetable = (): MobileTimetable => ({
  ...emptyTimetable("2020-12-28"),
  stops: [
    {
      id: "stop000001",
      name: "Ford Cross",
      where: "Shop",
      location: null,
      areaDocumentId: null,
    },
  ],
  visits: [
    {
      id: "visit00001",
      stopId: "stop000001",
      day: "mon",
      arrive: "09:00",
      depart: "09:30",
      repeat: { kind: "cycle", weeks: [1] },
      termTimeOnly: false,
      validFrom: null,
      validTo: null,
    },
  ],
})
function Editor({
  initial = timetable(),
  changed,
}: {
  initial?: MobileTimetable
  changed: (tt: MobileTimetable) => void
}) {
  const [value, setValue] = useState(initial)

  return (
    <TimetableEditor
      value={value}
      onChange={(next) => {
        changed(next)
        setValue(next)
      }}
    />
  )
}
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("TimetableEditor", () => {
  it("keeps later stop edits when a pin's area lookup completes", async () => {
    let complete!: (area: { documentId: string; name: string }) => void
    areaLookup.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve
        })
    )
    const changed = vi.fn()
    render(<Editor changed={changed} />)
    // The stop row expands inline; its pin map and fields live inside it.
    const row = screen.getAllByRole("button", { name: /^Ford Cross/ })[0]
    expect(row?.getAttribute("aria-expanded")).toBe("false")
    fireEvent.click(row!)
    expect(row?.getAttribute("aria-expanded")).toBe("true")
    fireEvent.click(screen.getByRole("button", { name: "Move stop pin" }))
    fireEvent.change(screen.getByLabelText("Stop name"), {
      target: { value: "Ford Cross Market" },
    })
    await act(async () => {
      complete({
        documentId: "area00000000000000000001",
        name: "West district",
      })
    })
    await waitFor(() =>
      expect(changed.mock.lastCall?.[0].stops[0]).toMatchObject({
        id: "stop000001",
        name: "Ford Cross Market",
        location: { lat: 51.5, lng: -0.12 },
        areaDocumentId: "area00000000000000000001",
      })
    )
    expect(screen.getByText(/Area: West district/)).toBeTruthy()
  })

  it("previews and validates a column-mapped import before changing the timetable", () => {
    const changed = vi.fn()
    render(<Editor initial={emptyTimetable("2026-10-05")} changed={changed} />)
    fireEvent.click(
      screen.getByRole("button", { name: "Paste from a spreadsheet" })
    )
    fireEvent.change(screen.getByLabelText("Spreadsheet rows"), {
      target: {
        value: "Stop\tDay\tArrive\tLeave\nVillage hall\tMonday\t09:30\t10:00",
      },
    })
    expect(screen.getByText("Import preview · first 12 visits")).toBeTruthy()
    expect(screen.getByText("Village hall")).toBeTruthy()
    expect(changed).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Import 1 visits" }))
    expect(changed.mock.lastCall?.[0].visits[0]).toMatchObject({
      day: "mon",
      arrive: "09:30",
      depart: "10:00",
    })
    expect(screen.getByRole("region", { name: "Find stop pins" })).toBeTruthy()
  })

  it("asks in a sheet before removing a stop, and removes it on confirm", () => {
    const changed = vi.fn()
    render(<Editor changed={changed} />)
    fireEvent.click(screen.getAllByRole("button", { name: /^Ford Cross/ })[0]!)
    fireEvent.click(screen.getByRole("button", { name: "Remove this stop" }))
    const sheet = within(
      screen.getByRole("region", { name: "Remove this stop?" })
    )
    expect(
      sheet.getByText(/Ford Cross and every visit there \(1 in the cycle\)/)
    ).toBeTruthy()
    expect(changed).not.toHaveBeenCalled()
    fireEvent.click(sheet.getByRole("button", { name: "Keep the stop" }))
    expect(
      screen.queryByRole("region", { name: "Remove this stop?" })
    ).toBeNull()
    expect(screen.getByText("Ford Cross", { selector: "span" })).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Remove this stop" }))
    fireEvent.click(
      within(
        screen.getByRole("region", { name: "Remove this stop?" })
      ).getByRole("button", { name: "Remove Ford Cross" })
    )
    expect(changed.mock.lastCall?.[0]).toMatchObject({ stops: [], visits: [] })
    expect(
      screen.queryByRole("region", { name: "Remove this stop?" })
    ).toBeNull()
  })

  it("picks the day with the segmented control's radios", () => {
    render(<Editor changed={vi.fn()} />)
    const picker = screen.getByRole("group", { name: "Weekday" })
    const monday = within(picker).getByRole("radio", { name: /^Mon/ })
    expect((monday as HTMLInputElement).checked).toBe(true)
    expect(monday.closest("label")?.textContent).toContain("1 stop")
    expect(screen.getByRole("heading", { name: "Monday, Week 1" })).toBeTruthy()
    expect(screen.getAllByRole("button", { name: /^Ford Cross/ }).length).toBe(
      1
    )
    // Weekends stay out of the picker until asked for.
    expect(within(picker).queryByRole("radio", { name: /^Sat/ })).toBeNull()

    fireEvent.click(within(picker).getByRole("radio", { name: /^Tue/ }))
    expect(
      screen.getByRole("heading", { name: "Tuesday, Week 1" })
    ).toBeTruthy()
    expect(screen.queryByRole("button", { name: /^Ford Cross/ })).toBeNull()
    expect(
      within(picker).getByRole("radio", { name: /^Tue/ }).closest("label")
        ?.textContent
    ).toContain("0 stops")
  })

  it("blocks an import containing overlapping visits", () => {
    const changed = vi.fn()
    render(<Editor initial={emptyTimetable("2026-10-05")} changed={changed} />)
    fireEvent.click(
      screen.getByRole("button", { name: "Paste from a spreadsheet" })
    )
    fireEvent.change(screen.getByLabelText("Spreadsheet rows"), {
      target: {
        value:
          "Stop,Day,Arrive,Leave\nHall,Monday,09:30,10:00\nShop,Monday,09:45,10:30",
      },
    })
    expect(
      (
        screen.getByRole("button", {
          name: "Import 2 visits",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
    expect(screen.getByRole("alert").textContent).toContain("overlaps")
    expect(changed).not.toHaveBeenCalled()
  })
})
