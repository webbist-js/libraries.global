// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  loading: true,
  allowed: false,
  error: false,
  checked: vi.fn(),
}))
vi.mock("@strapi/strapi/admin", () => ({
  useAuth: (_name: string, selector: (value: unknown) => unknown) =>
    selector({
      isLoading: state.loading,
      user: { id: 1 },
      permissions: state.allowed ? ["roles"] : [],
    }),
  useRBAC: () => {
    state.checked()

    return {
      isLoading: false,
      error: state.error,
      allowedActions: { canManageRoles: state.allowed },
    }
  },
  Page: {
    Loading: () => <p>Loading auth</p>,
    Error: () => <p>Check failed</p>,
    NoPermissions: () => <p>Access denied</p>,
  },
}))
vi.mock("../../src/plugins/access/admin/src/pages/PeoplePage", () => ({
  PeoplePage: () => <h1>People</h1>,
}))
vi.mock("../../src/plugins/access/admin/src/pages/TeamsPage", () => ({
  TeamsPage: () => <h1>Teams</h1>,
}))
vi.mock("../../src/plugins/access/admin/src/pages/PlansPage", () => ({
  PlansPage: () => <h1>Plans</h1>,
}))
import { App } from "../../src/plugins/access/admin/src/pages/App"

afterEach(cleanup)
beforeEach(() => {
  state.loading = true
  state.allowed = false
  state.error = false
  state.checked.mockClear()
})
it("waits for auth, admits an authorised direct load and rechecks permission changes", () => {
  const ui = () => (
    <MemoryRouter>
      <App />
    </MemoryRouter>
  )
  const view = render(ui())
  expect(screen.getByText("Loading auth")).toBeTruthy()
  expect(state.checked).not.toHaveBeenCalled()
  state.loading = false
  state.allowed = true
  view.rerender(ui())
  expect(screen.getByRole("heading", { name: "People" })).toBeTruthy()
  state.allowed = false
  view.rerender(ui())
  expect(screen.queryByRole("heading", { name: "People" })).toBeNull()
  expect(screen.getByText("Access denied")).toBeTruthy()
})
it("keeps permission-check failures separate from denied access", () => {
  state.loading = false
  state.error = true
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>
  )
  expect(screen.getByText("Check failed")).toBeTruthy()
  expect(screen.queryByText("Access denied")).toBeNull()
})
