// @vitest-environment happy-dom
import {
  DesignSystemProvider,
  lightTheme,
  darkTheme,
} from "@strapi/design-system"
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }))
vi.mock("@strapi/strapi/admin", () => ({
  useFetchClient: () => mocks,
  useRBAC: () => ({
    allowedActions: { canRevealCredentials: true },
    isLoading: false,
  }),
}))
import { CredentialForm } from "../../src/plugins/events/admin/src/components/CredentialForm"
import { RevealCredentialButton } from "../../src/plugins/events/admin/src/components/RevealCredentialButton"

beforeEach(() => {
  vi.clearAllMocks()
  mocks.get.mockResolvedValue({ data: { data: [] } })
})
afterEach(cleanup)
it.each([lightTheme, darkTheme])(
  "labels credential fields and supports Escape dismissal in either theme",
  async (theme) => {
    const cancel = vi.fn()
    render(
      <DesignSystemProvider theme={theme}>
        <CredentialForm credential={null} onSaved={vi.fn()} onCancel={cancel} />
      </DesignSystemProvider>
    )
    expect(screen.getByRole("dialog", { name: "Add credential" })).toBeTruthy()
    expect(screen.getByLabelText("Label", { exact: false })).toBeTruthy()
    expect(
      screen.getByRole("combobox", { name: "Search libraries" })
    ).toBeTruthy()
    expect(
      screen.getByLabelText("Organisation ID", { exact: false })
    ).toBeTruthy()
    expect(
      screen.getByLabelText("Private token", { exact: false })
    ).toBeTruthy()
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
    await waitFor(() => expect(cancel).toHaveBeenCalledOnce())
  }
)
it("never displays a delayed reveal after dismissal or on reopening", async () => {
  let resolve!: (value: unknown) => void
  mocks.post
    .mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        })
    )
    .mockImplementation(() => new Promise(() => {}))
  render(
    <DesignSystemProvider theme={lightTheme}>
      <RevealCredentialButton documentId="credential-1" slot="current" />
    </DesignSystemProvider>
  )
  fireEvent.click(screen.getByRole("button", { name: "Reveal value" }))
  await screen.findByText("Loading…")
  fireEvent.click(screen.getByRole("button", { name: "Close" }))
  await act(async () => {
    resolve({ data: { data: { apiKey: "STALE_SYNTHETIC_SECRET" } } })
  })
  fireEvent.click(screen.getByRole("button", { name: "Reveal value" }))
  expect(screen.queryByText("STALE_SYNTHETIC_SECRET")).toBeNull()
  expect(screen.getByText("Loading…")).toBeTruthy()
})
it.each([lightTheme, darkTheme])(
  "keeps unsaved changes until discard is confirmed in either theme",
  async (theme) => {
    const cancel = vi.fn()
    render(
      <DesignSystemProvider theme={theme}>
        <CredentialForm credential={null} onSaved={vi.fn()} onCancel={cancel} />
      </DesignSystemProvider>
    )
    const label = screen.getByLabelText("Label", { exact: false })
    fireEvent.change(label, { target: { value: "Synthetic feed" } })
    fireEvent.click(screen.getByRole("button", { name: "Cancel", exact: true }))
    const confirmation = await screen.findByRole("alertdialog", {
      name: "Discard credential changes?",
    })
    const descriptionId = confirmation.getAttribute("aria-describedby") ?? ""
    expect(descriptionId).toBeTruthy()
    expect(document.getElementById(descriptionId)).toBeTruthy()
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Keep editing" })
      )
    )
    expect(cancel).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }))
    expect((label as HTMLInputElement).value).toBe("Synthetic feed")
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
    await screen.findByRole("alertdialog", {
      name: "Discard credential changes?",
    })
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }))
    expect(cancel).toHaveBeenCalledOnce()
  }
)
it.each([lightTheme, darkTheme])(
  "searches published libraries and selects one with the keyboard in either theme",
  async (theme) => {
    mocks.get.mockResolvedValue({
      data: {
        data: [{ documentId: "library-fixture", name: "Fixture Library" }],
      },
    })
    render(
      <DesignSystemProvider theme={theme}>
        <CredentialForm
          credential={null}
          onSaved={vi.fn()}
          onCancel={vi.fn()}
        />
      </DesignSystemProvider>
    )
    const search = screen.getByRole("combobox", { name: "Search libraries" })
    fireEvent.change(search, { target: { value: "Fixture" } })
    await screen.findByRole("option", { name: "Fixture Library" })
    expect(search.getAttribute("aria-controls")).toBe(
      screen.getByRole("listbox").id
    )
    fireEvent.keyDown(search, { key: "ArrowDown" })
    fireEvent.keyDown(search, { key: "Enter" })
    expect(
      screen.getByRole("button", { name: "Remove Fixture Library" })
    ).toBeTruthy()
    expect(search.getAttribute("aria-expanded")).toBe("false")
    expect((search as HTMLInputElement).value).toBe("")
  }
)
