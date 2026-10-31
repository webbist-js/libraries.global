// @vitest-environment happy-dom
import type { AnchorHTMLAttributes } from "react"
import { afterEach, expect, it, vi } from "vitest"

import {
  SiteSearchMount,
  SiteSearchTrigger,
} from "@/components/global/SiteSearch"
import { installGoogleAnalytics } from "@/lib/google-analytics"
import { cleanup, fireEvent, render, screen, waitFor } from "@/test/render"

const router = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock("@/lib/navigation", () => ({
  usePathname: () => "/knowledge",
  useRouter: () => router,
  Link: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} />,
}))
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  router.push.mockReset()
  delete window.librariesGlobalAnalytics
  delete window.gtag
  delete window.dataLayer
})
it.each(["pointer", "keyboard"])(
  "tracks site-search selections once via %s without search text",
  async (method) => {
    window.location.href = "https://libraries.global/knowledge"
    vi.spyOn(document.head, "append").mockImplementation(() => {})
    const controller = installGoogleAnalytics(window)!
    controller.setConsent(true)
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        Response.json({
          items: url.includes("PRIVATE_QUERY")
            ? [
                {
                  id: "knowledge:public_article",
                  group: "knowledge",
                  title: "Public result",
                  summary: "A guide",
                  href: "/knowledge/public-article",
                },
              ]
            : [],
          counts: { knowledge: url.includes("PRIVATE_QUERY") ? 1 : 0 },
          unavailable: [],
          estimated: [],
        })
      )
    )
    render(
      <>
        <SiteSearchTrigger />
        <SiteSearchMount />
      </>
    )
    fireEvent.click(
      screen.getByRole("button", { name: "Search Libraries Global" })
    )
    const input = await screen.findByRole("combobox")
    fireEvent.change(input, { target: { value: "PRIVATE_QUERY" } })
    const row = await screen.findByText("Public result")
    if (method === "pointer") fireEvent.click(row.closest("a")!)
    else fireEvent.keyDown(input, { key: "Enter" })
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    const events = window.dataLayer!.flatMap((row) => {
      const entry = row as {
        event?: string
        analytics?: Record<string, string>
      }

      return entry.event === "lg_analytics" &&
        entry.analytics?.interaction_source === "site_search"
        ? [entry.analytics]
        : []
    })
    expect(events.map((row) => row.event_name)).toEqual([
      "navigation_action",
      "search",
      "search_results",
      "select_content",
    ])
    expect(JSON.stringify(events)).not.toContain("PRIVATE_QUERY")
    expect(events.at(-1)).toMatchObject({
      content_type: "knowledge",
      content_id: "public_article",
      search_scope: "all",
    })
    if (method === "keyboard")
      expect(router.push).toHaveBeenCalledWith("/knowledge/public-article")
  }
)
