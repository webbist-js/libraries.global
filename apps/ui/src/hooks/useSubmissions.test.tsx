// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, cleanup, renderHook, waitFor } from "@testing-library/react"
import { createElement, type ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const session = vi.hoisted(() => ({
  data: { user: { id: "a" } } as { user: { id: string } } | null,
  isPending: false,
}))
vi.mock("@/lib/access-client", () => ({ useHydratedSession: () => session }))
const measured = vi.hoisted(() => vi.fn())
const capture = vi.hoisted(() => vi.fn(() => measured))
vi.mock("@/lib/workspace-analytics", () => ({
  captureWorkspaceRouteAction: capture,
}))
import {
  useCreateSubmission,
  useFinalizeDraft,
  useMySubmissions,
  useResumeDraft,
} from "./useSubmissions"

const fetch = vi.fn()
function clientWrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
}
const client = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
beforeEach(() => {
  session.data = { user: { id: "a" } }
  session.isPending = false
  fetch.mockReset()
  capture.mockClear()
  measured.mockClear()
  vi.stubGlobal("fetch", fetch)
})

describe("submission analytics outcomes", () => {
  it("does not count draft creation as a submission", async () => {
    fetch.mockResolvedValueOnce(
      Response.json({ data: { documentId: "PRIVATE_DRAFT" } })
    )
    const view = renderHook(useCreateSubmission, {
      wrapper: clientWrapper(client()),
    })
    await act(async () => {
      await view.result.current.mutateAsync({
        submissionType: "new_library",
        asDraft: true,
      })
    })
    expect(capture).not.toHaveBeenCalled()
    expect(measured).not.toHaveBeenCalled()
  })

  it("records an accepted direct submission without its content", async () => {
    fetch.mockResolvedValueOnce(
      Response.json({ data: { documentId: "PRIVATE_SUBMISSION" } })
    )
    const view = renderHook(useCreateSubmission, {
      wrapper: clientWrapper(client()),
    })
    await act(async () => {
      await view.result.current.mutateAsync({
        submissionType: "new_library",
        note: "PRIVATE_NOTE",
      })
    })
    expect(capture).toHaveBeenCalledExactlyOnceWith("submit")
    expect(measured).toHaveBeenCalledExactlyOnceWith("success")
  })

  it("records a refused finalization once and preserves the caller's error", async () => {
    fetch.mockResolvedValueOnce(
      Response.json({ error: "private detail" }, { status: 403 })
    )
    const view = renderHook(useFinalizeDraft, {
      wrapper: clientWrapper(client()),
    })
    await act(async () => {
      await expect(
        view.result.current.mutateAsync({
          id: "PRIVATE_ID",
          formData: { text: "PRIVATE_TEXT" },
        })
      ).rejects.toThrow("Request failed: 403")
    })
    expect(capture).toHaveBeenCalledExactlyOnceWith("submit")
    expect(measured).toHaveBeenCalledExactlyOnceWith("error")
  })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("private contribution cache boundaries", () => {
  it("does not show another account's cached submissions while the new account loads", async () => {
    const cache = client()
    fetch.mockResolvedValueOnce(
      Response.json({
        data: [{ documentId: "private-a", title: "A's unpublished work" }],
      })
    )
    const view = renderHook(useMySubmissions, { wrapper: clientWrapper(cache) })
    await waitFor(() =>
      expect(view.result.current.data?.[0]?.documentId).toBe("private-a")
    )
    let resolve!: (value: Response) => void
    fetch.mockImplementationOnce(
      () =>
        new Promise<Response>((done) => {
          resolve = done
        })
    )
    session.data = { user: { id: "b" } }
    view.rerender()
    expect(view.result.current.data).toBeUndefined()
    await act(async () =>
      resolve(Response.json({ data: [{ documentId: "private-b" }] }))
    )
    await waitFor(() =>
      expect(view.result.current.data?.[0]?.documentId).toBe("private-b")
    )
  })

  it("isolates matching draft type, target and locale across accounts", async () => {
    const cache = client()
    fetch.mockResolvedValueOnce(
      Response.json({
        data: {
          documentId: "draft-a",
          draftData: { title: "Private draft A" },
        },
      })
    )
    const view = renderHook(
      () => useResumeDraft("wiki_edit", "same-story", "fr"),
      { wrapper: clientWrapper(cache) }
    )
    await waitFor(() =>
      expect(view.result.current.data?.documentId).toBe("draft-a")
    )
    let resolve!: (value: Response) => void
    fetch.mockImplementationOnce(
      () =>
        new Promise<Response>((done) => {
          resolve = done
        })
    )
    session.data = { user: { id: "b" } }
    view.rerender()
    expect(view.result.current.data).toBeUndefined()
    await act(async () =>
      resolve(
        Response.json({
          data: {
            documentId: "draft-b",
            draftData: { title: "Private draft B" },
          },
        })
      )
    )
    await waitFor(() =>
      expect(view.result.current.data?.documentId).toBe("draft-b")
    )
  })

  it("hides private cached data and sends no lookup even for manual refetch during hydration or sign-out", async () => {
    const cache = client()
    fetch.mockImplementation(async (url: string) =>
      Response.json({
        data: url.endsWith("/my")
          ? [{ documentId: "private-a" }]
          : { documentId: "draft-a" },
      })
    )
    const view = renderHook(
      () => ({
        list: useMySubmissions(),
        draft: useResumeDraft("blog_submission", "story", "en"),
      }),
      { wrapper: clientWrapper(cache) }
    )
    await waitFor(() =>
      expect(view.result.current.list.data?.[0]?.documentId).toBe("private-a")
    )
    await waitFor(() =>
      expect(view.result.current.draft.data?.documentId).toBe("draft-a")
    )
    fetch.mockClear()
    session.isPending = true
    view.rerender()
    expect(view.result.current.list.data).toBeUndefined()
    expect(view.result.current.list.isLoading).toBe(true)
    expect(view.result.current.draft.data).toBeUndefined()
    await act(async () => {
      await view.result.current.list.refetch()
      await view.result.current.draft.refetch()
    })
    expect(fetch).not.toHaveBeenCalled()
    session.data = null
    session.isPending = false
    view.rerender()
    expect(view.result.current.list.data).toBeUndefined()
    expect(view.result.current.draft.data).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })
})
