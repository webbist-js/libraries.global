import { describe, expect, it } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import { publicLibraryNetworks } from "../src/utils/public-library-networks"

describe("public library memberships", () => {
  it("projects reviewed memberships without exposing source or private editorial metadata", async () => {
    const network = {
      documentId: "network",
      name: "Test service",
      slug: "test-service",
      kind: "library_service",
      publicPageEnabled: true,
      publicPageReviewedAt: "2026-10-26T00:00:00Z",
      publicPageReviewedBy: "private-reviewer",
      sourceKey: "private-import-key",
      countries: [{ secret: true }],
    }
    const { strapi } = makeFakeStrapi({
      "api::library.library": [
        {
          documentId: "library",
          publishedAt: "2026-10-26T00:00:00Z",
          locale: "en",
          networks: [
            network,
            { ...network, documentId: "hidden", publicPageEnabled: false },
            {
              ...network,
              documentId: "unreviewed",
              publicPageReviewedAt: null,
            },
          ],
        },
      ],
    })
    expect(await publicLibraryNetworks(strapi, "library")).toEqual([
      {
        documentId: "network",
        name: "Test service",
        slug: "test-service",
        kind: "library_service",
        publicPageEnabled: true,
        publicPageReviewedAt: "2026-10-26T00:00:00Z",
      },
    ])
  })
  it("does not create membership information for a missing published library", async () => {
    const { strapi } = makeFakeStrapi()
    expect(await publicLibraryNetworks(strapi, "missing")).toEqual([])
  })
})
