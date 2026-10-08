// @vitest-environment happy-dom
import { renderHook } from "@testing-library/react"
import { act, createElement } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

const session = vi.hoisted(() => ({
  data: null as null | { user: Record<string, unknown> },
  isPending: false,
}))
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: session.data, isPending: session.isPending }),
  },
}))

const { useEntitlements, useStaff } = await import("../access-client")

const ID = "lib000000000000000000001"
const OTHER = "lib000000000000000000002"

afterEach(() => {
  session.data = null
  session.isPending = false
})

describe("useEntitlements", () => {
  it("is public with nothing unlocked while signed out", () => {
    const { result } = renderHook(() => useEntitlements())
    expect(result.current.plan).toBe("public")
    expect(result.current.can("atlas.export")).toBe(false)
    expect(result.current.canForLibrary("library.team", ID)).toBe(false)
    expect(result.current.ready).toBe(true)
  })

  it("unlocks library-scoped features only for the viewer's Team libraries", () => {
    session.data = {
      user: {
        plan: "pro",
        features: ["atlas.export", "library.team", "library.traffic"],
        teamLibraryIds: [ID],
      },
    }
    const { result } = renderHook(() => useEntitlements())
    expect(result.current.plan).toBe("pro")
    expect(result.current.can("library.team")).toBe(true)
    expect(result.current.canForLibrary("library.team", ID)).toBe(true)
    expect(result.current.canForLibrary("library.traffic", ID)).toBe(true)
    // A personal Team feature never unlocks a library the Team doesn't cover.
    expect(result.current.canForLibrary("library.team", OTHER)).toBe(false)
    expect(result.current.canForLibrary("library.traffic", OTHER)).toBe(false)
    // Personal features stay personal, whatever the library.
    expect(result.current.canForLibrary("atlas.export", OTHER)).toBe(true)
  })

  it("reads a missing plan as free and malformed team ids as none", () => {
    session.data = { user: { features: [], teamLibraryIds: "nope" } }
    const { result } = renderHook(() => useEntitlements())
    expect(result.current.plan).toBe("free")
    expect(result.current.canForLibrary("library.team", ID)).toBe(false)
  })
})

describe("useStaff", () => {
  it("exposes the session's staff libraries, teams and per-library checks", () => {
    session.data = {
      user: {
        capabilities: ["staff.area"],
        staffLibraries: [
          {
            id: ID,
            role: "editor",
            canGoLive: true,
            name: "Van",
            slug: "van",
            libraryType: "Mobile",
          },
        ],
        teams: [
          {
            id: "t1",
            name: "Kent",
            slug: "kent",
            role: "member",
            libraryCount: 1,
          },
        ],
        teamLibraryIds: [ID],
      },
    }
    const { result } = renderHook(() => useStaff())
    expect(result.current.libraries.map((l) => l.id)).toEqual([ID])
    expect(result.current.teams).toEqual([
      { id: "t1", name: "Kent", slug: "kent", role: "member", libraryCount: 1 },
    ])
    expect(result.current.teamLibraryIds).toEqual([ID])
    expect(result.current.roleFor(ID)).toBe("editor")
    expect(result.current.roleFor(OTHER)).toBeNull()
    expect(result.current.can("goLive", ID)).toBe(true)
    expect(result.current.can("manageTeam", ID)).toBe(false)
    expect(result.current.can("edit", OTHER)).toBe(false)
  })

  it("is not ready while the session loads", () => {
    session.isPending = true
    const { result } = renderHook(() => useStaff())
    expect(result.current.ready).toBe(false)
    expect(result.current.libraries).toEqual([])
  })

  it("hydrates as the server rendered it when the store already holds a session, then reads it", async () => {
    ;(
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true
    const Probe = () => {
      const staff = useStaff()

      return createElement(
        "output",
        null,
        staff.ready ? `staff:${staff.libraries.length}` : "pending"
      )
    }
    // The server has no session store.
    session.data = null
    session.isPending = true
    const html = renderToString(createElement(Probe))
    expect(html).toContain("pending")

    // The client: Better Auth's store resolved before this subtree
    // hydrated (the header subscribed first), so the hook could already see
    // staff libraries. Hydration must still match the server's markup.
    session.data = {
      user: {
        staffLibraries: [
          {
            id: ID,
            role: "owner",
            canGoLive: false,
            name: "Central",
            slug: "central",
            libraryType: "Public",
          },
        ],
      },
    }
    session.isPending = false
    const container = document.createElement("div")
    container.innerHTML = html
    document.body.append(container)
    const recoverable: unknown[] = []
    await act(async () => {
      hydrateRoot(container, createElement(Probe), {
        onRecoverableError: (error) => recoverable.push(error),
      })
    })
    expect(recoverable).toEqual([])
    // Mounted: the session is read and the staff branch renders.
    expect(container.textContent).toBe("staff:1")
    container.remove()
  })
})
