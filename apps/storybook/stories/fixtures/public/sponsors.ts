import type { SponsorAcknowledgements } from "@/lib/sponsor/acknowledgements"

/** Fictional organisations, as GET /api/sponsors/acknowledgements returns them. */
export const sponsorAcknowledgements: SponsorAcknowledgements = {
  status: "ok",
  sponsors: [
    {
      name: "Northfield Reading Trust",
      tier: "founding",
      website: "https://example.org/northfield",
      acknowledgement:
        "Funds translation of the site and its guides into Czech and Spanish.",
      logo: {
        url: "/library-placeholder.svg",
        alternativeText: null,
        width: 160,
        height: 64,
      },
    },
    {
      name: "Harbour Libraries Network",
      tier: "service",
      website: null,
      acknowledgement: "Supports data quality review for coastal regions.",
      logo: null,
    },
    {
      name: "Open Shelf Cooperative",
      tier: "community",
      website: "https://example.org/open-shelf",
      acknowledgement: null,
      logo: null,
    },
  ],
}

export const noSponsorAcknowledgements: SponsorAcknowledgements = {
  status: "ok",
  sponsors: [],
}

export const unavailableSponsorAcknowledgements: SponsorAcknowledgements = {
  status: "unavailable",
  sponsors: [],
}
