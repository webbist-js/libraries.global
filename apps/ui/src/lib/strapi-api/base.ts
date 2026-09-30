import type { FindFirst, FindMany, ID, Result, UID } from "@repo/strapi-types"

import { getEnvVar } from "@/lib/env-vars"
import { isDevelopment } from "@/lib/general-helpers"
import { mapLimit } from "@/lib/map-limit"
import { cacheTagsFor } from "@/lib/strapi-api/cache-tags"
import { API_ENDPOINTS } from "@/lib/strapi-api/endpoints"
import { eqOrNull } from "@/lib/strapi-api/query-builder"
import type {
  APIResponse,
  APIResponseCollection,
  AppLocalizedParams,
  DynamicZonePopulateParams,
} from "@/types/api"
import type { AppError, CustomFetchOptions } from "@/types/general"

export { API_ENDPOINTS }

/** Cached Strapi reads live this long unless a webhook purges them first. */
export const DEFAULT_REVALIDATE_SECONDS = 300

/** How many pages `fetchAll` asks Strapi for at once. */
const FETCH_ALL_CONCURRENCY = 4

/**
 * A stable sort for paging: the caller's order, then documentId, so two
 * pages never overlap or skip when rows tie on the sort key.
 */
function stableSort(sort: unknown): string[] {
  const given =
    typeof sort === "string"
      ? [sort]
      : Array.isArray(sort)
        ? sort.filter((s): s is string => typeof s === "string")
        : []

  return given.includes("documentId:asc") ? given : [...given, "documentId:asc"]
}

export default abstract class BaseStrapiClient {
  public async fetchAPI(
    path: string,
    params: AppLocalizedParams<Record<string, unknown>> = {},
    requestInit?: RequestInit,
    options?: CustomFetchOptions
  ) {
    const { url, headers } = await this.prepareRequest(
      path,
      {
        ...params,
        ...(options?.doNotAddLocaleQueryParams
          ? {}
          : { locale: params.locale }),
      },
      requestInit,
      options
    )

    const response = await fetch(url, {
      ...requestInit,
      next: {
        ...requestInit?.next,
        // if revalidate is set to a number since 0 implies cache: 'no-store' and a positive value implies cache: 'force-cache'.
        revalidate: isDevelopment()
          ? 0
          : (requestInit?.next?.revalidate ?? DEFAULT_REVALIDATE_SECONDS),
        // Per-model and per-entry tags, purged by POST /api/revalidate.
        tags: [
          ...new Set([
            ...cacheTagsFor(path, params),
            ...(requestInit?.next?.tags ?? []),
          ]),
        ],
      },
      headers: {
        ...requestInit?.headers,
        ...headers,
      },
    })

    const { json, text } = await this.parseResponse(response)

    if (text) {
      const appError: AppError = {
        name: "Invalid response format",
        message: text,
        status: response.status,
        details: { url },
      }
      console.error("[BaseStrapiClient] Strapi API request error:", appError)
      throw new Error(JSON.stringify(appError))
    }

    if (!response.ok) {
      const { error } = json
      const appError: AppError = {
        name: error?.name,
        message: error?.message,
        details: {
          url,
        },
        status: response.status ?? error?.status,
      }
      if (getEnvVar("DEBUG_STRAPI_CLIENT_API_CALLS")) {
        console.error("[BaseStrapiClient] Strapi API request error:", appError)
      }
      throw new Error(JSON.stringify(appError))
    }

    return json
  }

  /**
   * Fetches one document by ID or Single type (without ID)
   */
  public async fetchOne<
    TContentTypeUID extends UID.ContentType,
    TParams extends AppLocalizedParams<FindFirst<TContentTypeUID>>,
  >(
    uid: TContentTypeUID,
    documentId?: ID | undefined,
    params?: TParams,
    requestInit?: RequestInit,
    options?: CustomFetchOptions
  ): Promise<
    APIResponse<Result<TContentTypeUID, DynamicZonePopulateParams<TParams>>>
  > {
    const path = this.getStrapiApiPathByUId(uid)
    const url = `${path}${documentId ? `/${documentId}` : ""}`

    return this.fetchAPI(url, params, requestInit, options)
  }

  /**
   * Fetches multiple documents
   */
  public async fetchMany<
    TContentTypeUID extends UID.ContentType,
    TParams extends AppLocalizedParams<FindMany<TContentTypeUID>>,
  >(
    uid: TContentTypeUID,
    params?: TParams,
    requestInit?: RequestInit,
    options?: CustomFetchOptions
  ): Promise<
    APIResponseCollection<
      Result<TContentTypeUID, DynamicZonePopulateParams<TParams>>
    >
  > {
    const path = this.getStrapiApiPathByUId(uid)

    return this.fetchAPI(path, params, requestInit, options)
  }

  /**
   * Fetches all documents
   */
  public async fetchAll<
    TContentTypeUID extends UID.ContentType,
    TParams extends AppLocalizedParams<FindMany<TContentTypeUID>>,
  >(
    uid: TContentTypeUID,
    params?: TParams,
    requestInit?: RequestInit,
    options?: CustomFetchOptions
  ): Promise<APIResponseCollection<Result<TContentTypeUID, TParams>>> {
    const path = this.getStrapiApiPathByUId(uid)

    // Strapi can be configured in https://docs.strapi.io/dev-docs/configurations/api
    const maxPageSize = 100
    const pagedParams = {
      ...params,
      sort: stableSort((params as { sort?: unknown } | undefined)?.sort),
    }

    const firstPage: APIResponseCollection<Result<TContentTypeUID, TParams>> =
      await this.fetchAPI(
        path,
        { ...pagedParams, pagination: { page: 1, pageSize: maxPageSize } },
        requestInit,
        options
      )

    if (firstPage.meta.pagination.pageCount <= 1) {
      return firstPage
    }

    const pages = Array.from(
      { length: firstPage.meta.pagination.pageCount - 1 },
      (_, i) => i + 2
    )
    const otherPages = await mapLimit(pages, FETCH_ALL_CONCURRENCY, (page) =>
      this.fetchAPI(
        path,
        { ...pagedParams, pagination: { page, pageSize: maxPageSize } },
        requestInit,
        options
      )
    )

    return Promise.resolve(otherPages).then((res) => ({
      data: [firstPage.data, ...res.map((page) => page.data)].flat(),
      meta: {
        pagination: {
          page: 1,
          pageCount: 1,
          pageSize: firstPage.meta.pagination.total,
          total: firstPage.meta.pagination.total,
        },
      },
    }))
  }

  /**
   * Fetches a single entity by slug
   */
  public async fetchOneBySlug<
    TContentTypeUID extends UID.ContentType,
    TParams extends AppLocalizedParams<FindMany<TContentTypeUID>>,
  >(
    uid: TContentTypeUID,
    slug: string | null,
    params?: TParams,
    requestInit?: RequestInit,
    options?: CustomFetchOptions
  ): Promise<
    APIResponse<Result<TContentTypeUID, DynamicZonePopulateParams<TParams>>>
  > {
    const slugFilter = eqOrNull(slug)
    const mergedParams = {
      ...params,
      sort: { publishedAt: "desc" },
      filters: { ...params?.filters, slug: slugFilter },
    }
    const path = this.getStrapiApiPathByUId(uid)
    const response: APIResponseCollection<
      Result<TContentTypeUID, DynamicZonePopulateParams<TParams>>
    > = await this.fetchAPI(path, mergedParams, requestInit, options)

    // return last published entry
    return {
      data: response.data.pop() ?? null,
      meta: {},
    }
  }

  protected abstract prepareRequest(
    path: string,
    params: object,
    requestInit?: RequestInit,
    options?: CustomFetchOptions
  ): Promise<{ url: string; headers: Record<string, string> }>

  /**
   * Get Path of the API route by UID
   * @param uid - UID of the Endpoint
   * @returns API Endpoint path
   */
  public getStrapiApiPathByUId(uid: keyof typeof API_ENDPOINTS): string {
    const path = API_ENDPOINTS[uid]
    if (path) {
      return path
    }
    throw new Error(
      `Endpoint for UID "${uid}" not found. Extend API_ENDPOINTS in lib/api/client.ts.`
    )
  }

  private async parseResponse(response: Response) {
    const contentType = response.headers.get("content-type")
    if (contentType?.includes("application/json")) {
      return {
        contentType,
        json: await response.json(),
      }
    }

    return {
      contentType,
      text: await response.text(),
    }
  }
}
