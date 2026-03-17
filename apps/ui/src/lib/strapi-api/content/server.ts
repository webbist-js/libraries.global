import "server-only"

import type { Data, UID } from "@repo/strapi-types"
import { draftMode } from "next/headers"
import type { Locale } from "next-intl"

import type { HomepageContinentSummary } from "@/components/home/homepage.types"
import { logNonBlockingError } from "@/lib/logging"
import { PublicStrapiClient } from "@/lib/strapi-api"
import type {
  APIResponse,
  APIResponseCollection,
  StrapiLocalization,
} from "@/types/api"
import type { CustomFetchOptions } from "@/types/general"

type PopulatedPageData = Data.ContentType<"api::page.page"> & {
  localizations?: StrapiLocalization[]
  seo?: Data.Component<"shared.seo"> | null
}

type PopulatedHomepageData = Data.ContentType<"api::homepage.homepage"> & {
  featuredLibraries?: Data.ContentType<"api::library.library">[]
  featuredServices?: Data.ContentType<"api::service.service">[]
  localizations?: StrapiLocalization[]
  seo?: Data.Component<"shared.seo"> | null
}

type PopulatedNavbarData = Data.ContentType<"api::navbar.navbar"> & {
  links?: Data.Component<"utilities.link">[]
  logoImage?: Data.Component<"utilities.image-with-link"> | null
}

type PopulatedFooterData = Data.ContentType<"api::footer.footer"> & {
  links?: Data.Component<"utilities.link">[]
  socialLinks?: Data.Component<"shared.social">[]
  sections?: Data.Component<"elements.footer-item">[]
}

// ------ Page fetching functions

export async function fetchPage(
  slug: string,
  locale: Locale,
  requestInit?: RequestInit,
  options?: CustomFetchOptions
) {
  const dm = await draftMode()

  try {
    return (await PublicStrapiClient.fetchOneBySlug(
      "api::page.page",
      slug,
      {
        locale,
        status: dm.isEnabled ? "draft" : "published",
      },
      requestInit,
      options
    )) as APIResponse<PopulatedPageData>
  } catch (e: unknown) {
    logNonBlockingError({
      message: `Error fetching page '${slug}' for locale '${locale}'`,
      error: {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
    })
  }
}

export async function fetchAllPages(
  // eslint-disable-next-line @typescript-eslint/default-param-last
  uid: Extract<UID.ContentType, "api::page.page"> = "api::page.page",
  locale: Locale
) {
  try {
    return await PublicStrapiClient.fetchAll(uid, {
      locale,
      fields: ["slug", "locale", "updatedAt", "createdAt"],
      populate: {},
      status: "published",
    })
  } catch (e: unknown) {
    logNonBlockingError({
      message: `Error fetching all pages for locale '${locale}'`,
      error: {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
    })

    return { data: [] }
  }
}

// ------ SEO fetching functions

export async function fetchSeo(
  // eslint-disable-next-line @typescript-eslint/default-param-last
  uid: Extract<UID.ContentType, "api::page.page"> = "api::page.page",
  slug: string | null,
  locale: Locale
) {
  try {
    return (await PublicStrapiClient.fetchOneBySlug(uid, slug, {
      locale,
    })) as APIResponse<PopulatedPageData>
  } catch (e: unknown) {
    logNonBlockingError({
      message: `Error fetching SEO for '${uid}' with slug '${slug}' for locale '${locale}'`,
      error: {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
    })
  }
}

// ------ Homepage fetching functions

export async function fetchHomepage(locale: Locale) {
  const dm = await draftMode()

  try {
    return (await PublicStrapiClient.fetchOne(
      "api::homepage.homepage",
      undefined,
      {
        locale,
        status: dm.isEnabled ? "draft" : "published",
      }
    )) as APIResponse<PopulatedHomepageData>
  } catch (e: unknown) {
    logNonBlockingError({
      message: `Error fetching homepage for locale '${locale}'`,
      error: {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
    })
  }
}

export async function fetchHomepageContinents(locale: Locale) {
  const dm = await draftMode()

  try {
    return (await PublicStrapiClient.fetchAPI("/homepage/continents", {
      locale,
      status: dm.isEnabled ? "draft" : "published",
    })) as APIResponseCollection<HomepageContinentSummary>
  } catch (e: unknown) {
    logNonBlockingError({
      message: `Error fetching homepage continents for locale '${locale}'`,
      error: {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
    })
  }
}

// ------ Navbar fetching functions

export async function fetchNavbar(locale: Locale) {
  try {
    return (await PublicStrapiClient.fetchOne("api::navbar.navbar", undefined, {
      locale,
    })) as APIResponse<PopulatedNavbarData>
  } catch (e: unknown) {
    logNonBlockingError({
      message: `Error fetching navbar for locale '${locale}'`,
      error: {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
    })
  }
}

// ------ Footer fetching functions

export async function fetchFooter(locale: Locale) {
  try {
    return (await PublicStrapiClient.fetchOne("api::footer.footer", undefined, {
      locale,
    })) as APIResponse<PopulatedFooterData>
  } catch (e: unknown) {
    logNonBlockingError({
      message: `Error fetching footer for locale '${locale}'`,
      error: {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
    })
  }
}
