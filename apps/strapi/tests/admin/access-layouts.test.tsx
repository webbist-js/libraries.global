// @vitest-environment happy-dom
import {
  DesignSystemProvider,
  lightTheme,
  darkTheme,
} from "@strapi/design-system"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

const f = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
  notify: vi.fn(),
}))
vi.mock("@strapi/strapi/admin", () => ({
  useFetchClient: () => f,
  useNotification: () => ({ toggleNotification: f.notify }),
  Page: {
    Main: ({ children, ...props }: React.ComponentProps<"main">) => (
      <main {...props}>{children}</main>
    ),
  },
}))
import { PersonModal } from "../../src/plugins/access/admin/src/components/PersonModal"
import { TeamDetailModal } from "../../src/plugins/access/admin/src/components/TeamDetailModal"

beforeEach(() => {
  vi.clearAllMocks()
})
afterEach(cleanup)

it.each([lightTheme, darkTheme])(
  "shows role status, dates and complete notes without a crowded table in either theme",
  async (theme) => {
    f.get.mockResolvedValue({
      data: {
        data: {
          baUserId: "fixture-user",
          username: "librarian",
          displayName: "Fixture Librarian",
          email: null,
          contributorRole: "contributor",
          acceptedCount: 0,
          isVerifiedLibrarian: true,
          locales: ["en"],
          openApplications: [],
          grants: [
            {
              documentId: "grant-active",
              role: "verified_librarian",
              queue: "all",
              locale: null,
              source: "admin",
              status: "active",
              createdAt: "2026-10-20T12:00:00Z",
              expiresAt: null,
              reason: "Checked affiliation with the library.",
            },
            {
              documentId: "grant-revoked",
              role: "wiki_editor",
              queue: "all",
              locale: "en",
              source: "admin",
              status: "revoked",
              createdAt: "2026-10-19T12:00:00Z",
              expiresAt: "2026-10-20T12:00:00Z",
              reason: "Original grant.\nRevoked after the assignment ended.",
            },
          ],
        },
      },
    })
    const close = vi.fn()
    render(
      <DesignSystemProvider theme={theme}>
        <MemoryRouter>
          <PersonModal
            baUserId="fixture-user"
            onClose={close}
            onChanged={vi.fn()}
          />
        </MemoryRouter>
      </DesignSystemProvider>
    )
    await screen.findByText("Fixture Librarian")
    expect(screen.queryByRole("table")).toBeNull()
    expect(
      screen.getByRole("button", { name: "Revoke Verified librarian" })
    ).toBeTruthy()
    expect(
      screen.queryByRole("button", { name: "Revoke Knowledge editor" })
    ).toBeNull()
    expect(screen.getByText("Revoked")).toBeTruthy()
    expect(screen.getByText("No expiry")).toBeTruthy()
    expect(screen.getByText(/Revoked after the assignment ended/)).toBeTruthy()
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
    await waitFor(() => expect(close).toHaveBeenCalledOnce())
  }
)

it.each([lightTheme, darkTheme])(
  "keeps Team role labels, assignment state and member removal accessible in either theme",
  (theme) => {
    const team = {
      documentId: "fixture-team",
      name: "Fixture Library Service",
      status: "active",
      verifiedAt: null,
      source: "checkout",
      createdAt: "2026-10-21T00:00:00Z",
      expiresAt: "2027-10-21T00:00:00Z",
      seats: 5,
      used: 1,
      libraries: [],
      organiserNames: ["Fixture Organiser"],
      notes: null,
      members: [
        {
          documentId: "fixture-member",
          name: "Fixture Organiser",
          email: "organiser@example.test",
          teamRole: "organiser",
          status: "active",
          acceptedAt: "2026-10-21T00:00:00Z",
          assignments: [],
          pending: [],
          preassign: null,
        },
      ],
    }
    render(
      <DesignSystemProvider theme={theme}>
        <TeamDetailModal
          team={team as never}
          onClose={vi.fn()}
          onEdit={vi.fn()}
          onChanged={vi.fn()}
        />
      </DesignSystemProvider>
    )
    const dialog = screen.getByRole("dialog")
    expect(within(dialog).queryByRole("table")).toBeNull()
    expect(within(dialog).getByText("No libraries assigned")).toBeTruthy()
    expect(
      within(dialog).getByRole("combobox", {
        name: "Team role for Fixture Organiser",
      })
    ).toBeTruthy()
    expect(
      within(dialog).getByRole("button", { name: "Remove Fixture Organiser" })
    ).toBeTruthy()
    expect(
      within(dialog).getByLabelText("Email", { exact: false })
    ).toBeTruthy()
    expect(f.post).not.toHaveBeenCalled()
    expect(f.del).not.toHaveBeenCalled()
  }
)
