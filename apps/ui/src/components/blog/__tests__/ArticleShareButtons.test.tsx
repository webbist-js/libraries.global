// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest"

import { cleanup, fireEvent, render, waitFor } from "@/test/render"

import { ArticleShareButtons } from "../ArticleShareButtons"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("article sharing", () => {
  it("shares the full localized article URL after navigating from a landing page", () => {
    const initial = "https://libraries.global/journal/data/story"
    const translated = "https://libraries.global/fr/journal/data/story"
    const { getByRole, rerender } = render(
      <ArticleShareButtons title="A story" url={initial} />
    )
    rerender(<ArticleShareButtons title="Un récit" url={translated} />)
    const intent = new URL(getByRole("link").getAttribute("href")!)
    expect(intent.searchParams.get("url")).toBe(translated)
    expect(intent.searchParams.get("text")).toBe("Un récit")
  })

  it("copies the article URL rather than a previous page location", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("navigator", { clipboard: { writeText } })
    const url = "https://libraries.global/cs/journal/data/story"
    const { getByRole } = render(<ArticleShareButtons url={url} />)
    fireEvent.click(getByRole("button", { name: "Copy link" }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(url))
  })
})
