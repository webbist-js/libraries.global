import type { UID } from "@repo/strapi-types"

// Add endpoints here that are queried from the frontend.
// Mapping of Strapi content type UIDs to API endpoint paths. Kept free of
// imports so cache tags and route handlers can read it without the client.
export const API_ENDPOINTS: Partial<Record<UID.ContentType, string>> = {
  "api::page.page": "/pages",
  "api::footer.footer": "/footer",
  "api::homepage.homepage": "/homepage",
  "api::subscriber.subscriber": "/subscribers",
  "api::library.library": "/libraries",
  "api::continent.continent": "/continents",
  "api::country.country": "/countries",
  "api::region.region": "/regions",
  "api::blog-article.blog-article": "/blog-articles",
  "api::blog-landing.blog-landing": "/blog-landing",
  "api::wiki-article.wiki-article": "/wiki-articles",
  "api::wiki-landing.wiki-landing": "/wiki-landing",
  "api::accessibility.accessibility": "/accessibility-features",
  "api::amenity.amenity": "/amenities",
  "api::library-type.library-type": "/library-types",
  "api::service.service": "/services",
  "api::drive.drive": "/drives",
} as const
