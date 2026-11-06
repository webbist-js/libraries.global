import {
  API_REACH_PER_HOUR,
  CONTRIBUTOR_REACH_PER_WEEK,
  FEATURES,
  SUPPORTER_MIN_ACCEPTED,
} from "@repo/access"
import { describe, expect, it } from "vitest"

import { MEMBERSHIP_FAQ_COUNT } from "../localized-plans"
import {
  API_OFFER,
  FEATURE_STATUS,
  OFFER_KEYS,
  OFFERS,
  offer,
  offerValues,
  RECOGNITION,
  SPONSOR_TIERS,
  standingName,
  standingProgress,
} from "../plans"

import cs from "../../../locales/cs.json"
import en from "../../../locales/en.json"
import es from "../../../locales/es.json"
import fr from "../../../locales/fr.json"
import pricing from "../membership-pricing.json"

const LOCALES = { en, fr, cs, es } as const
const get = (messages: unknown, path: string): unknown =>
  path
    .split(".")
    .reduce<unknown>(
      (o, k) =>
        o && typeof o === "object"
          ? (o as Record<string, unknown>)[k]
          : undefined,
      messages
    )

describe("OFFERS", () => {
  it("lists the five offers in order", () => {
    expect(OFFERS.map((o) => o.key)).toEqual([
      "explorer",
      "contributor",
      "staff",
      "api",
      "sponsor",
    ])
    expect(OFFER_KEYS).toEqual(OFFERS.map((o) => o.key))
  })

  it("keeps Explorer, Contributor and Verified Staff free; only API Access is a monthly purchase", () => {
    expect(offer("explorer").price).toEqual({ kind: "free" })
    expect(offer("contributor").price).toEqual({ kind: "earned" })
    expect(offer("staff").price).toEqual({ kind: "free" })
    expect(offer("api").price).toEqual({
      kind: "monthly",
      pence: pricing.api.month,
      taxInclusive: true,
    })
    expect(offer("sponsor").price).toEqual({
      kind: "yearFrom",
      pence: pricing.sponsor.community,
    })
  })

  it("reads amounts and allowances from the pricing file and resolver", () => {
    expect(API_OFFER.monthPence).toBe(10_000)
    expect(API_OFFER.requests).toBe(10_000)
    expect(API_OFFER.mib).toBe(250)
    expect(API_OFFER.analysisCredits).toBe(100)
    expect(SPONSOR_TIERS.map((t) => t.yearPence)).toEqual([
      250_000, 500_000, 1_000_000,
    ])
    expect(RECOGNITION.supporterAt).toBe(SUPPORTER_MIN_ACCEPTED)
    expect(RECOGNITION.reachPerWeek).toBe(CONTRIBUTOR_REACH_PER_WEEK)
  })

  it("states that payment, sponsorship and recognition never grant authority", () => {
    for (const key of ["contributor", "staff", "api", "sponsor"] as const)
      expect(offer(key).items.some((i) => i.status === "note")).toBe(true)
  })

  it("gives every feature a status", () => {
    expect(Object.keys(FEATURE_STATUS).sort()).toEqual([...FEATURES].sort())
  })
})

describe("offerValues", () => {
  it("formats prices and allowances for the locale", () => {
    const en = offerValues("en-GB")
    expect(en.apiPrice).toBe("£100")
    expect(en.requestPrice).toBe("£0.01")
    expect(en.communityPrice).toBe("£2,500")
    expect(en.foundingPrice).toBe("£10,000")
    expect(en.apiRequests).toBe("10,000")
    expect(en.apiMib).toBe("250")
    expect(en.apiReachPerHour).toBe(API_REACH_PER_HOUR)
    expect(offerValues("fr").apiRequests).not.toBe("10,000")
  })
})

describe("offer and comparison messages", () => {
  const values = offerValues("en-GB")
  it.each(Object.entries(LOCALES))("%s has every offer message", (_, m) => {
    for (const o of OFFERS) {
      const prefix = `membershipContent.offers.${o.key}`
      for (const key of ["name", "who", "price", "priceNote"])
        expect(get(m, `${prefix}.${key}`), `${prefix}.${key}`).toBeTypeOf(
          "string"
        )
      expect(get(m, `${prefix}.cta.${o.cta.id}`)).toBeTypeOf("string")
      for (const item of o.items)
        expect(
          get(m, `${prefix}.items.${item.id}`),
          `${prefix}.items.${item.id}`
        ).toBeTypeOf("string")
    }
    for (let i = 0; i < MEMBERSHIP_FAQ_COUNT; i++) {
      expect(get(m, `membershipContent.faq.${i}.q`)).toBeTypeOf("string")
      expect(get(m, `membershipContent.faq.${i}.a`)).toBeTypeOf("string")
    }
  })

  it("only interpolates values offerValues provides", () => {
    const text = JSON.stringify(get(en, "membershipContent"))
    const used = new Set(
      [...text.matchAll(/\{(\w+)(?:[,}])/g)].map((match) => match[1]!)
    )
    for (const name of used)
      if (!["count", "group", "first", "second"].includes(name))
        expect(Object.keys(values), name).toContain(name)
  })

  it("never offers a personal paid plan", () => {
    const text = JSON.stringify(get(en, "membershipContent.offers"))
    expect(text).not.toMatch(/\bPro\b|Team plan|seat price|£[358]\b/)
  })
})

describe("standingProgress", () => {
  it("starts signed-in accounts as Explorer, one contribution from Contributor", () => {
    expect(standingProgress({ signedIn: true })).toEqual({
      standing: "explorer",
      accepted: 0,
      next: { standing: "contributor", at: 1 },
      remaining: 1,
      percent: 0,
    })
  })

  it("counts towards Supporter once a Contributor", () => {
    expect(
      standingProgress({ signedIn: true, acceptedContributions: 37 })
    ).toEqual({
      standing: "contributor",
      accepted: 37,
      next: { standing: "supporter", at: 100 },
      remaining: 63,
      percent: 37,
    })
  })

  it("reaches Supporter at 100 and caps progress", () => {
    const progress = standingProgress({
      signedIn: true,
      acceptedContributions: 250,
    })
    expect(progress.standing).toBe("supporter")
    expect(progress.next).toBeNull()
    expect(progress.remaining).toBe(0)
    expect(progress.percent).toBe(100)
  })

  it("resets on revocation and ignores malformed counts", () => {
    expect(
      standingProgress({
        signedIn: true,
        acceptedContributions: 120,
        recognitionRevoked: true,
      })
    ).toMatchObject({ standing: "explorer", accepted: 0, remaining: 1 })
    expect(
      standingProgress({ signedIn: true, acceptedContributions: -4 }).accepted
    ).toBe(0)
    expect(
      standingProgress({ signedIn: true, acceptedContributions: 2.5 }).accepted
    ).toBe(0)
  })

  it("reports signed-out viewers as public", () => {
    expect(standingProgress({ signedIn: false }).standing).toBe("public")
  })
})

describe("standingName", () => {
  it("maps unknown values to public", () => {
    expect(standingName("supporter")).toBe("supporter")
    expect(standingName("pro")).toBe("public")
    expect(standingName(undefined)).toBe("public")
  })
})
