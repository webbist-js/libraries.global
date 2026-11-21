import { expect, it, vi } from "vitest"

const { fetchLibrary } = vi.hoisted(() => ({ fetchLibrary: vi.fn() }))

vi.mock("@/components/library/LibraryDetailPage", () => ({
  default: () => null,
}))
vi.mock("@/components/seo/JsonLd", () => ({ JsonLd: () => null }))
vi.mock("@/i18n/scoped-messages", () => ({
  withMessages: (page: unknown) => page,
}))
vi.mock("@/lib/strapi-api/content/server", () => ({ fetchLibrary }))

import { generateMetadata } from "@/app/[locale]/(dashboard)/[continent]/[country]/[region]/[library]/page"

it("advertises the canonical library Markdown variant", async () => {
  fetchLibrary.mockResolvedValue({
    data: {
      name: "Central Library",
      slug: "central-library",
      summary: "A public library.",
      continent: { slug: "europe" },
      country: { slug: "england", name: "England" },
      region: { slug: "london" },
    },
    localeFallback: false,
  })

  const metadata = await generateMetadata({
    params: Promise.resolve({
      locale: "en",
      continent: "europe",
      country: "england",
      region: "london",
      library: "central-library",
    }),
  })

  expect(metadata.alternates?.canonical).toBe(
    "/europe/england/london/central-library"
  )
  expect(metadata.alternates?.types?.["text/markdown"]).toBe(
    "/europe/england/london/central-library.md"
  )
})
