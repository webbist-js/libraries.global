// @vitest-environment happy-dom
import { afterEach, it, expect, vi } from "vitest"

import { cleanup, render, screen, fireEvent, waitFor } from "@/test/render"

import { ArticleReaderActions } from "./ArticleReaderActions"

vi.mock("@/lib/access-client", () => ({
  useHydratedSession: () => ({
    data: { user: { id: "reader" } },
    isPending: false,
    error: null,
  }),
  useCapabilities: () => ({
    ready: true,
    canDirectEdit: (_kind: string, locale: string) => locale === "fr",
  }),
}))
vi.mock("@/lib/navigation", () => ({
  routing: { locales: ["en", "fr", "cs"] },
  Link: ({ href, children }: any) => <a href={href}>{children}</a>,
}))
vi.mock(
  "@/app/[locale]/profile/[username]/_components/ProfileFollowButton",
  () => ({ ProfileFollowButton: () => null })
)
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
it("keeps published variants tied to the displayed language and chooses a configured missing translation", async () => {
  const fetcher = vi.fn().mockResolvedValue(
    Response.json({
      data: [
        { code: "en", name: "English" },
        { code: "es", name: "Spanish" },
        { code: "fr", name: "French" },
      ],
    })
  )
  vi.stubGlobal("fetch", fetcher)
  render(
    <ArticleReaderActions
      kind="knowledge"
      slug="guide"
      path="/knowledge/practice/guide"
      contentLocale="es"
      interfaceLocale="en"
      availableLocales={["es", "en"]}
    />
  )
  expect(
    screen.getByRole("link", { name: "Read in English" }).getAttribute("href")
  ).toBe("/knowledge/practice/guide")
  expect(
    screen
      .getByRole("link", { name: "Suggest an improvement" })
      .getAttribute("href")
  ).toContain("mode=report&locale=es")
  fireEvent.click(screen.getByRole("button", { name: "Add a translation" }))
  await waitFor(() =>
    expect(screen.getByRole("option", { name: "French" })).toBeTruthy()
  )
  expect(screen.queryByRole("option", { name: "Spanish" })).toBeNull()
  fireEvent.change(screen.getByLabelText("Choose a translation language"), {
    target: { value: "fr" },
  })
  expect(
    screen.getByRole("link", { name: "Add a translation" }).getAttribute("href")
  ).toBe("/contribute/knowledge/guide?locale=fr&sourceLocale=es&mode=edit")
})

it.each([true, false])(
  "offers ordinary author editing only from ownership proof (%s), including hidden public attribution",
  async (isOwner) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        Response.json({ data: { eligibility: { story: isOwner } } })
      )
    )
    render(
      <ArticleReaderActions
        kind="journal"
        slug="story"
        path="/journal/feature/story"
        contentLocale="es"
        interfaceLocale="en"
        authorUsername={null}
      />
    )
    if (isOwner)
      expect(
        (
          await screen.findByRole("link", { name: "Edit your story" })
        ).getAttribute("href")
      ).toBe("/contribute/knowledge/journal/story?locale=es&sourceLocale=es")
    else {
      await waitFor(() =>
        expect(
          screen.queryByRole("link", { name: "Edit your story" })
        ).toBeNull()
      )
      expect(screen.getByRole("link", { name: "Discuss" })).toBeTruthy()
    }
  }
)
