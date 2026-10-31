import { headers } from "next/headers"

import { staffPathname } from "@/app/[locale]/(dashboard)/staff/_lib/staff-pathname"
import {
  StaffAccessRequired,
  type ClaimableStaffLibrary,
} from "@/components/staff/StaffAccessRequired"
import { getSessionSSR } from "@/lib/auth-server"
import { isStaffSlugParam } from "@/lib/staff/paths"
import { PublicStrapiClient } from "@/lib/strapi-api"

type PublicRow = ClaimableStaffLibrary & {
  continent?: { slug?: string }
  country?: { slug?: string }
  region?: { slug?: string }
}

/**
 * A denied staff route reads only the library's published public identity,
 * found by the slug in the path (`/staff/{slug}/…`).
 */
export default async function StaffNotFound() {
  const pathname = await staffPathname()
  const slug = pathname?.split(/[/?#]/)[2]
  const session = await getSessionSSR(await headers())
  let library: ClaimableStaffLibrary | undefined
  if (slug && !["team", "teams"].includes(slug) && isStaffSlugParam(slug)) {
    const result = (await PublicStrapiClient.fetchMany(
      "api::library.library",
      {
        filters: { slug: { $eq: slug } },
        fields: ["name", "slug", "entityRef"],
        populate: {
          continent: { fields: ["slug"] },
          country: { fields: ["slug"] },
          region: { fields: ["slug"] },
        },
        status: "published",
        pagination: { pageSize: 1 },
      } as never,
      { next: { revalidate: 0 } }
    )) as { data?: PublicRow[] }
    const row = result.data?.[0]
    if (row) {
      const parts = [
        row.continent?.slug,
        row.country?.slug,
        row.region?.slug,
        row.slug,
      ]
      library = {
        documentId: row.documentId,
        name: row.name,
        slug: row.slug,
        entityRef: row.entityRef,
        path: parts.every(Boolean) ? `/${parts.join("/")}` : null,
      }
    }
  }

  return (
    <StaffAccessRequired
      library={library}
      signedIn={!!session?.user}
      returnTo={pathname}
    />
  )
}
