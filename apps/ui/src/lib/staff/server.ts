import "server-only"
import { SESSION_PROFILE_MAX_CLAIMS } from "@repo/access"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { cache } from "react"

import { requireStaff, staffLibrariesOf } from "@/lib/access-server"
import { getSessionSSR } from "@/lib/auth-server"
import { isDocumentIdParam } from "@/lib/bridge-params"
import { isStaffSlugParam } from "@/lib/staff/paths"
import {
  fetchStaff,
  resolveTargetStaff,
  withTargetStaff,
} from "@/lib/staff-proxy"
import { PublicStrapiClient } from "@/lib/strapi-api"

import type { StaffOverview } from "./types"

/**
 * A staff page's data, or the right refusal. Staff pages are addressed by
 * the library's slug; the staff APIs by its document id. 404 for a
 * malformed slug, a library outside the viewer's staff memberships or a
 * non-staff viewer, including signed-out visitors, and for Strapi's own
 * 401, 403 or 404. The staff not-found boundary offers the public library's
 * claim flow without rendering any private data. `pathname` keeps page and
 * layout calls cached together.
 */
export const loadStaffPage = cache(async (slug: string, _pathname?: string) => {
  if (!isStaffSlugParam(slug)) notFound()
  const session = await getSessionSSR(await headers())
  if (!session?.user) notFound()
  let user = session.user
  let libraries = staffLibrariesOf(user)
  if (!libraries.some((library) => library.slug === slug)) {
    if (libraries.length < SESSION_PROFILE_MAX_CLAIMS) notFound()
    const target = await resolveTargetStaff(user, slug)
    if (!target) notFound()
    user = withTargetStaff(user, target)
    libraries = staffLibrariesOf(user)
  }
  const matches = libraries.filter((library) => library.slug === slug)
  if (matches.length !== 1) notFound()
  const id = matches[0]!.id
  if (!isDocumentIdParam(id)) notFound()
  if (requireStaff(user, id, "seeTeam")) notFound()
  const result = await fetchStaff<StaffOverview>(
    user,
    `libraries/${id}/overview`
  )
  if ([401, 403, 404].includes(result.status)) notFound()
  if (result.status !== 200 || !result.body)
    throw new Error(
      "The Staff area is temporarily unavailable. Try again shortly."
    )
  if (
    result.body.library.documentId !== id ||
    result.body.library.slug !== slug
  )
    notFound()

  return {
    user,
    libraries,
    documentId: id,
    overview: result.body,
  }
})

export type StaffLibraryMeta = {
  operatorName: string | null
  homeLibrary: { name: string; path: string | null } | null
}

type MetaRow = {
  operatorName?: string | null
  homeLibrary?: {
    name?: string | null
    slug?: string | null
    continent?: { slug?: string | null } | null
    country?: { slug?: string | null } | null
    region?: { slug?: string | null } | null
  } | null
}

/**
 * The shell's meta line: the operator and, for a Mobile library, its home
 * base. One small public read; a failure reads as nothing to show.
 */
export const fetchStaffLibraryMeta = cache(
  async (documentId: string): Promise<StaffLibraryMeta> => {
    const none: StaffLibraryMeta = { operatorName: null, homeLibrary: null }
    try {
      const res = (await PublicStrapiClient.fetchMany(
        "api::library.library",
        {
          filters: { documentId: { $eq: documentId } },
          fields: ["operatorName"],
          populate: {
            homeLibrary: {
              fields: ["name", "slug"],
              populate: {
                continent: { fields: ["slug"] },
                country: { fields: ["slug"] },
                region: { fields: ["slug"] },
              },
            },
          },
          status: "published",
          pagination: { pageSize: 1 },
        } as never,
        { next: { revalidate: 0 } }
      )) as { data?: MetaRow[] }
      const row = res.data?.[0]
      if (!row) return none
      const home = row.homeLibrary
      const parts = [
        home?.continent?.slug,
        home?.country?.slug,
        home?.region?.slug,
        home?.slug,
      ]

      return {
        operatorName: row.operatorName?.trim() || null,
        homeLibrary: home?.name
          ? {
              name: home.name,
              path: parts.every(Boolean) ? `/${parts.join("/")}` : null,
            }
          : null,
      }
    } catch {
      return none
    }
  }
)
