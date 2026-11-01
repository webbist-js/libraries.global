// @vitest-environment happy-dom
import type { AnchorHTMLAttributes } from "react"
import { afterEach, expect, it, vi } from "vitest"

import type { Submission } from "@/hooks/useSubmissions"
import { cleanup, fireEvent, render, screen, within } from "@/test/render"

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

it("offers a named library draft and dismisses the prompt without removing the card", () => {
  state.data = [
    {
      documentId: "older-library",
      submissionType: "new_library",
      status: "draft",
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
      draftData: { name: "Town Library" },
    },
  ]
  render(<ResumeWork prompt />)
  const dialog = screen.getByRole("dialog")
  expect(
    within(dialog)
      .getByRole("link", { name: /Town Library/ })
      .getAttribute("href")
  ).toBe("/contribute/index/new?draft=contribute&resume=older-library")
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Dismiss and explore" })
  )
  expect(screen.queryByRole("dialog")).toBeNull()
  expect(screen.getByRole("heading", { name: "Town Library" })).toBeTruthy()
  expect(state.data).toHaveLength(1)
})
