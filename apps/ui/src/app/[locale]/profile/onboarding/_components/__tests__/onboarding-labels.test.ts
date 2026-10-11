// @vitest-environment happy-dom
// apps/ui/src/app/[locale]/profile/onboarding/_components/__tests__/onboarding-labels.test.ts
//
// Every onboarding control is named by its visible label (WCAG 1.3.1 and
// 4.1.2), each group of options is labelled and says what's selected, and
// the username status is the field's live description, not part of its name.
import * as React from "react"
import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { cleanup, fireEvent, render, screen, within } from "@/test/render"

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

const USERNAME = "Username Required"

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
      avatarUrl: null,
    })
  )
  await screen.findByRole("button", { name: "Manuscripts" })
}

describe("OnboardingShell", () => {
  it("names each field by its visible label", async () => {
    await renderShell()

    for (const label of [
      "Display name Required",
      "Last name Optional",
      USERNAME,
      "Pronouns Required",
      "City Optional",
      "Short bio Optional",
      "Job title Optional",
      "Language",
      "Proficiency",
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
    expect(
      screen.getByLabelText("Pronouns Required").hasAttribute("aria-label")
    ).toBe(false)
    // The pickers are named by their label and read out their value.
    screen.getByRole("button", { name: "Country Optional Select country…" })
    screen.getByRole("button", { name: "Timezone Optional Select timezone…" })
    screen.getByRole("combobox", { name: "Proficiency" })
    screen.getByRole("textbox", {
      name: "Short bio Optional",
      description:
        "Shown at the top of your profile. Plain text only. 0 of 400",
    })
  })

  it("says the username status in a live description, not in its name", async () => {
    await renderShell()
    const input = screen.getByLabelText(USERNAME)

    fireEvent.change(input, { target: { value: "amelie" } })
    await screen.findByText("Available")

    expect(
      screen.getByRole("textbox", {
        name: USERNAME,
        description: /^Available Lowercase letters.*amelie$/,
      })
    ).toBe(input)
    const status = document.getElementById(
      input.getAttribute("aria-describedby")!.split(" ")[0]!
    )
    expect(status?.getAttribute("aria-live")).toBe("polite")
  })

  it("labels each group of options and says which are selected", async () => {
    await renderShell()

    const affiliation = screen.getByRole("radiogroup", {
      name: "Affiliation",
      description: /^How are you connected to libraries\?/,
    })
    expect(affiliation.getAttribute("aria-required")).toBe("true")
    const reader = within(affiliation).getByRole("radio", {
      name: /^Reader \/ enthusiast/,
      checked: false,
    })
    fireEvent.click(reader)
    expect((reader as HTMLInputElement).checked).toBe(true)

    const topics = screen.getByRole("group", { name: "Topics you care about" })
    within(topics).getByRole("button", { name: "Manuscripts", pressed: false })

    const visibility = screen.getByRole("radiogroup", {
      name: "Profile visibility",
    })
    within(visibility).getByRole("radio", { name: /^Public/, checked: true })
    within(visibility).getByRole("radio", { name: /^Private/, checked: false })
  })

  it("names each language's remove button after the language", async () => {
    await renderShell()

    screen.getByRole("group", { name: "Languages you can review in" })
    fireEvent.change(screen.getByLabelText("Language"), {
      target: { value: "fr" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Add language" }))
    fireEvent.click(screen.getByRole("button", { name: "Remove French" }))

    expect(screen.queryByRole("button", { name: "Remove French" })).toBeNull()
  })

  it("names the library claim's fields by their labels", async () => {
    await renderShell()

    fireEvent.click(
      screen.getByRole("radio", { name: /^Librarian \/ archivist/ })
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
    expect(screen.getByLabelText("Department Optional")).toBeTruthy()
  })

  it("counts the sections done and links each one", async () => {
    await renderShell()
    const card = screen.getByRole("region", { name: "Profile setup" })
    const bar = within(card).getByRole("progressbar", { name: "Profile setup" })

    // Visibility always has a value; the name came from the session.
    expect(bar.getAttribute("aria-valuenow")).toBe("1")
    within(card).getByText("2 required sections left.")
    expect(
      within(card)
        .getByRole("link", {
          name: /^Identity · required To do: Add a username and pronouns$/,
        })
        .getAttribute("href")
    ).toBe("#identity")

    fireEvent.change(screen.getByLabelText(USERNAME), {
      target: { value: "amelie" },
    })
    fireEvent.change(screen.getByLabelText("Pronouns Required"), {
      target: { value: "she_her" },
    })
    fireEvent.click(
      screen.getByRole("radio", { name: /^Reader \/ enthusiast/ })
    )

    await within(card).findByText("Required sections done. The rest can wait.")
    expect(bar.getAttribute("aria-valuenow")).toBe("3")
    within(card).getByRole("link", {
      name: /^Identity · required Done: @amelie$/,
    })
    within(card).getByRole("link", {
      name: /^Affiliation · required Done: Reader \/ enthusiast$/,
    })
  })
})
