import { FEATURES } from "@repo/access"
import { describe, expect, it } from "vitest"

import {
  PLANS,
  PRICES_ARE_PLACEHOLDERS,
  PRO_FEATURE_COPY,
  planCard,
  planStatusCopy,
  priceHeadline,
  showPlanCta,
} from "../plans"

const plan = (key: string) => {
  const card = PLANS.find((p) => p.key === key)
  if (!card) throw new Error(`no ${key} plan`)

  return card
}

describe("PLANS", () => {
  it("lists public, free, supporter, pro and team, in that order", () => {
    expect(PLANS.map((p) => p.key)).toEqual([
      "public",
      "free",
      "supporter",
      "pro",
      "team",
    ])
  })

  it("marks prices as placeholders", () => {
    expect(PRICES_ARE_PLACEHOLDERS).toBe(true)
  })

  it("uses the pricing spec's amounts", () => {
    expect(plan("public").price).toBe("free")
    expect(plan("free").price).toBe("free")
    expect(plan("supporter").price).toEqual({
      monthly: "£3/month",
      yearly: "£30/year",
    })
    expect(plan("pro").price).toMatchObject({
      monthly: "£5/month",
      yearly: "£50/year",
    })
    expect(plan("team").price).toMatchObject({ yearly: "£480/year ex VAT" })
  })

  it("gives Supporter no Pro feature: patronage buys nothing", () => {
    const labels = Object.values(PRO_FEATURE_COPY).map((c) => c.label)
    for (const item of plan("supporter").includes)
      for (const label of labels) expect(item.text).not.toContain(label)
  })

  it("keeps Supporter's patronage line a note, not an include", () => {
    const notes = plan("supporter").includes.filter((i) => i.kind === "note")
    expect(notes).toHaveLength(1)
    expect(notes[0]?.text).toContain("patronage")
  })

  it("tags exactly the unbuilt items as coming soon", () => {
    for (const card of PLANS)
      for (const item of card.includes)
        expect(item.text.endsWith(" (coming soon)")).toBe(item.kind === "soon")
  })

  it("never offers checkout: paid plans are coming soon, Team is a chat", () => {
    expect(plan("supporter").cta).toMatchObject({
      kind: "soon",
      label: "Coming soon",
    })
    expect(plan("pro").cta).toMatchObject({
      kind: "soon",
      label: "Coming soon",
    })
    expect(plan("team").cta).toMatchObject({
      kind: "contact",
      label: "Talk to us",
    })
    expect(plan("team").cta.href).toMatch(/^mailto:[^?]+@libraries\.global\?/)
    expect(plan("free").cta).toMatchObject({
      kind: "signup",
      href: "/auth/register?callbackUrl=/contribute/membership",
    })
  })

  it("builds Pro's list from the feature copy, flagging what isn't built", () => {
    const includes = plan("pro").includes
    expect(includes).toContainEqual({
      text: PRO_FEATURE_COPY["atlas.export"].label,
      kind: "feature",
    })
    expect(includes).toContainEqual({
      text: `${PRO_FEATURE_COPY["library.notes"].label} (coming soon)`,
      kind: "soon",
    })
    const texts = (key: string) =>
      plan(key)
        .includes.map((i) => i.text)
        .join("\n")
    expect(texts("pro")).not.toContain(PRO_FEATURE_COPY["team.workspace"].label)
    expect(texts("pro")).not.toContain(PRO_FEATURE_COPY["api.key"].label)
    expect(texts("team")).toContain(PRO_FEATURE_COPY["team.workspace"].label)
  })
})

describe("priceHeadline", () => {
  it("shows Free, else the monthly price, else the yearly one", () => {
    expect(priceHeadline(planCard("free").price)).toBe("Free")
    expect(priceHeadline(planCard("pro").price)).toBe("£5/month")
    expect(priceHeadline(planCard("team").price)).toBe("£480/year ex VAT")
  })
})

describe("showPlanCta", () => {
  it("offers sign-up only to visitors", () => {
    expect(showPlanCta(planCard("free"), undefined)).toBe(true)
    expect(showPlanCta(planCard("free"), "public")).toBe(true)
    expect(showPlanCta(planCard("free"), "free")).toBe(false)
    expect(showPlanCta(planCard("free"), "pro")).toBe(false)
  })

  it("drops 'coming soon' on the plan the member already holds", () => {
    expect(showPlanCta(planCard("pro"), "free")).toBe(true)
    expect(showPlanCta(planCard("pro"), "pro")).toBe(false)
    expect(showPlanCta(planCard("public"), "public")).toBe(false)
  })

  it("keeps 'talk to us' for Team members, who may want more seats", () => {
    expect(showPlanCta(planCard("team"), "team")).toBe(true)
    expect(showPlanCta(planCard("team"), undefined)).toBe(true)
  })
})

describe("PRO_FEATURE_COPY", () => {
  it("has copy for every feature", () => {
    for (const f of FEATURES) expect(PRO_FEATURE_COPY[f]?.label).toBeTruthy()
    expect(Object.keys(PRO_FEATURE_COPY).sort()).toEqual([...FEATURES].sort())
  })

  it("marks only the Atlas export and library history as live", () => {
    const live = Object.entries(PRO_FEATURE_COPY)
      .filter(([, c]) => c.status === "live")
      .map(([f]) => f)
    expect(live.sort()).toEqual(["atlas.export", "library.history"])
  })
})

describe("planStatusCopy", () => {
  it("names how the member got Pro", () => {
    expect(planStatusCopy("pro", "grant")).toBe(
      "You have Pro, granted by the libraries.global team."
    )
    expect(planStatusCopy("pro", "earned")).toBe(
      "You have Pro for your contributions (Archivist tier)."
    )
    expect(planStatusCopy("pro", "verified")).toBe(
      "You have Pro as verified library staff, student or charity."
    )
    expect(planStatusCopy("pro", "paid")).toBe("You're on Pro.")
  })

  it("names Team when the plan is Team", () => {
    expect(planStatusCopy("team", "grant")).toBe(
      "You have Team, granted by the libraries.global team."
    )
    expect(planStatusCopy("team", "paid")).toBe("You're on Team.")
  })

  it("says nothing for free, public or unknown values", () => {
    expect(planStatusCopy("free", "none")).toBeNull()
    expect(planStatusCopy("public", "none")).toBeNull()
    expect(planStatusCopy(undefined, undefined)).toBeNull()
    expect(planStatusCopy("pro", undefined)).toBeNull()
    expect(planStatusCopy("pro", "none")).toBeNull()
    expect(planStatusCopy("gold", "grant")).toBeNull()
  })
})
