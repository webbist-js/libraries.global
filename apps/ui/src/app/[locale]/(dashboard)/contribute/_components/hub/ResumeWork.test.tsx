// @vitest-environment happy-dom
import type { AnchorHTMLAttributes } from "react"
import { afterEach, expect, it, vi } from "vitest"

import type { Submission } from "@/hooks/useSubmissions"
import { cleanup, fireEvent, render, screen } from "@/test/render"

import { ResumeWork } from "./ResumeWork"

const state = vi.hoisted(() => ({
  data: [] as Submission[],
  loading: false,
  error: false,
  refetch: vi.fn(),
}))
vi.mock("@/hooks/useSubmissions", () => ({
  useMySubmissions: () => ({
    data: state.data,
    isLoading: state.loading,
    isError: state.error,
    refetch: state.refetch,
  }),
}))
vi.mock("@/lib/access-client", () => ({
  useCapabilities: () => ({ has: () => false }),
}))
vi.mock("@/lib/navigation", () => ({
  Link: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} />,
}))
afterEach(() => {
  cleanup()
  state.data = []
  state.loading = false
  state.error = false
  state.refetch.mockReset()
})

it("explains unavailable saved work and provides a retry", () => {
  state.error = true
  render(<ResumeWork />)
  expect(screen.getByRole("status").textContent).toContain("couldn’t be loaded")
  fireEvent.click(screen.getByRole("button", { name: "Try again" }))
  expect(state.refetch).toHaveBeenCalledOnce()
})
it("renders no empty card when there is nothing to resume", () => {
  render(<ResumeWork />)
  expect(screen.queryByRole("heading")).toBeNull()
})
it("labels an untitled draft and retains role gating when it is resumed", () => {
  state.data = [
    {
      documentId: "draft",
      submissionType: "wiki_edit",
      status: "draft",
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
      targetLabel: "",
      draftData: { title: " " },
    },
  ]
  render(<ResumeWork />)
  expect(screen.getByRole("heading", { name: "Your record" })).toBeTruthy()
  expect(
    screen.getByRole("link", { name: /Apply to edit/ }).getAttribute("href")
  ).toContain("/contribute/knowledge/apply")
})
