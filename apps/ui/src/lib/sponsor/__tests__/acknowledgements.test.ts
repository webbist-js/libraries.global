import { describe, expect, it } from "vitest"

import pricing from "@/lib/membership-pricing.json"

import {
  formatSponsorAmount,
  normaliseSponsorAcknowledgements,
  SPONSOR_ACKNOWLEDGEMENT_LIMIT,
  SPONSOR_ANCHORS,
} from "../acknowledgements"

describe("sponsor acknowledgements", () => {
  it("keeps valid rows and drops unknown tiers, blank names and unsafe links", () => {
    expect(
      normaliseSponsorAcknowledgements({
        data: [
          {
            name: " Northfield Trust ",
            tier: "founding",
            website: "https://example.org",
            acknowledgement: "Funds translation.",
            logo: { url: "/uploads/n.png", width: 320, height: 120 },
          },
          {
            name: "Script",
            tier: "service",
            // eslint-disable-next-line sonarjs/code-eval -- Deliberately unsafe fixture; it must never be served as a link.
            website: "javascript:alert(1)",
            // eslint-disable-next-line sonarjs/code-eval -- Deliberately unsafe fixture; it must never become an image source.
            logo: { url: "javascript:alert(1)" },
          },
          { name: "", tier: "community" },
          { name: "Unknown", tier: "platinum" },
        ],
      })
    ).toEqual([
      {
        name: "Northfield Trust",
        tier: "founding",
        website: "https://example.org/",
        acknowledgement: "Funds translation.",
        logo: {
          url: "/uploads/n.png",
          alternativeText: null,
          width: 320,
          height: 120,
        },
      },
      {
        name: "Script",
        tier: "service",
        website: null,
        acknowledgement: null,
        logo: null,
      },
    ])
  })

  it("never renders more than the public cap or a malformed payload", () => {
    const data = Array.from({ length: 150 }, (_, i) => ({
      name: `Sponsor ${i}`,
      tier: "community",
    }))
    expect(normaliseSponsorAcknowledgements({ data })).toHaveLength(
      SPONSOR_ACKNOWLEDGEMENT_LIMIT
    )
    expect(normaliseSponsorAcknowledgements(null)).toEqual([])
    expect(normaliseSponsorAcknowledgements({ data: "x" })).toEqual([])
  })

  it("formats the catalogue anchors as whole pounds per locale", () => {
    expect(
      SPONSOR_ANCHORS.map((tier) =>
        formatSponsorAmount(pricing.sponsor[tier], "en")
      )
    ).toEqual(["£2,500", "£5,000", "£10,000"])
    expect(formatSponsorAmount(pricing.sponsor.community, "fr")).toMatch(
      /^2\s500\s£$/
    )
    expect(formatSponsorAmount(pricing.sponsor.founding, "cs")).toMatch(
      /^10\s000\s£$/
    )
  })
})
