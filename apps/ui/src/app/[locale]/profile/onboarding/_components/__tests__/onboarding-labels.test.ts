// @vitest-environment happy-dom
// apps/ui/src/app/[locale]/profile/onboarding/_components/__tests__/onboarding-labels.test.ts
//
// Every onboarding control is named by its visible label (WCAG 1.3.1 and
// 4.1.2), each group of options is labelled and says what's selected, and
// the username status is the field's live description, not part of its name.
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import * as React from "react"
import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// vitest.config has no JSX runtime, so .tsx compiles to React.createElement.
Object.assign(globalThis, { React })

// The design-system index imports env validation; onboarding needs no env.
vi.mock("@/lib/env-vars", () => ({ getEnvVar: () => {} }))
vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))
// next-intl's navigation can't load under vitest; only Link is used.
vi.mock("@/lib/navigation", async () => {
  const { createElement: h } = await import("react")

  return {
    Link: ({ href, children }: { href: string; children?: React.ReactNode }) =>
      h("a", { href }, children),
  }
})
vi.mock("@/components/legal/legal.helpers", () => ({
  CODE_OF_CONDUCT_URL: "https://example.test/conduct",
}))

const { OnboardingShell } = await import("../OnboardingShell")

const USERNAME = "Username * → libraries.global/@handle"

function respond(url: string) {
  if (url.startsWith("/api/topics"))
    return Response.json({ data: [{ documentId: "t1", name: "Manuscripts" }] })
  if (url.startsWith("/api/profile/check-username"))
    return Response.json({ available: true })
  if (url.startsWith("/api/libraries/search"))
    return Response.json({ hits: [{ id: 1, name: "British Library" }] })

  return Response.json({})
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => respond(url))
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

/** Renders onboarding for a new account and waits for the topics to load. */
async function renderShell() {
  render(
    createElement(OnboardingShell, {
      sessionUser: {
        id: "u1",
        name: "Amélie Rault",
        email: "amelie@example.test",
        image: null,
      },
      initialProfile: null,
    })
  )
  await screen.findByRole("button", { name: "Manuscripts" })
}

describe("OnboardingShell", () => {
  it("names each field by its visible label", async () => {
    await renderShell()

    for (const label of [
      "Display name *",
      "Last name",
      USERNAME,
      "Pronouns *",
      "City · optional",
      "Short bio · optional",
      "Languages you can review in",
      "Website",
      "ORCID",
      "Mastodon / Bluesky",
      "LinkedIn",
    ]) {
      expect(screen.getByLabelText(label)).toBeTruthy()
    }
    // An aria-label would override the visible label.
    expect(screen.getByLabelText(USERNAME).hasAttribute("aria-label")).toBe(
      false
    )
    expect(screen.getByLabelText("Pronouns *").hasAttribute("aria-label")).toBe(
      false
    )
    // The pickers are named by their label and read out their value.
    screen.getByRole("button", { name: "Country · optional Select country…" })
    screen.getByRole("button", { name: "Timezone · optional Select timezone…" })
    screen.getByRole("combobox", { name: "Proficiency" })
    screen.getByRole("textbox", {
      name: "Short bio · optional",
      description:
        "Shown at the top of your profile. Plain text; no markdown. 0 / 320",
    })
  })

  it("says the username status in a live description, not in its name", async () => {
    await renderShell()
    const input = screen.getByLabelText(USERNAME)

    fireEvent.change(input, { target: { value: "amelie" } })
    await screen.findByText("Available ✓")

    expect(
      screen.getByRole("textbox", {
        name: USERNAME,
        description: "Available ✓",
      })
    ).toBe(input)
    const status = document.getElementById(
      input.getAttribute("aria-describedby")!
    )
    expect(status?.getAttribute("aria-live")).toBe("polite")
  })

  it("labels each group of options and says which are selected", async () => {
    await renderShell()

    const affiliation = screen.getByRole("group", { name: "Affiliation" })
    const reader = within(affiliation).getByRole("button", {
      name: /^Reader \/ enthusiast/,
      pressed: false,
    })
    fireEvent.click(reader)
    expect(reader.getAttribute("aria-pressed")).toBe("true")

    const topics = screen.getByRole("group", { name: "Topics you care about" })
    within(topics).getByRole("button", { name: "Manuscripts", pressed: false })

    const visibility = screen.getByRole("group", { name: "Profile visibility" })
    within(visibility).getByRole("button", { name: /^Public/, pressed: true })
    within(visibility).getByRole("button", { name: /^Private/, pressed: false })
  })

  it("names each language's remove button after the language", async () => {
    await renderShell()

    fireEvent.change(screen.getByLabelText("Languages you can review in"), {
      target: { value: "fr" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Add" }))
    fireEvent.click(screen.getByRole("button", { name: "Remove French" }))

    expect(screen.queryByRole("button", { name: "Remove French" })).toBeNull()
  })

  it("names the library claim's fields by their labels", async () => {
    await renderShell()

    fireEvent.click(
      screen.getByRole("button", { name: /^Librarian \/ archivist/ })
    )
    expect(screen.getByLabelText("Continent")).toBeTruthy()
    screen.getByRole("button", { name: "Country Select country…" })

    fireEvent.change(screen.getByLabelText("Search for your library"), {
      target: { value: "British" },
    })
    fireEvent.click(
      await screen.findByRole("button", { name: /British Library/ })
    )
    expect(screen.getByLabelText("Your role")).toBeTruthy()
    expect(screen.getByLabelText("Department (optional)")).toBeTruthy()
  })
})
