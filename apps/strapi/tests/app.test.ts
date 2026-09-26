import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { setupStrapi, strapi, teardownStrapi } from "./helpers/strapi"

describe("App Test Suite", () => {
  beforeAll(async () => {
    await setupStrapi()
  }, 60000)

  afterAll(async () => {
    await teardownStrapi()
  }, 30000)

  describe("strapi instance", () => {
    it("is defined", () => {
      expect(strapi).toBeDefined()
    })

    it("registers the atlas hierarchy and supporting content types", () => {
      const contentTypes = Object.keys(strapi.contentTypes)

      for (const uid of [
        "api::continent.continent",
        "api::country.country",
        "api::region.region",
        "api::area.area",
        "api::library.library",
        "api::user-profile.user-profile",
        "api::library-affiliation.library-affiliation",
        "api::saved-event.saved-event",
        "api::page.page",
        "api::subscriber.subscriber",
        "api::footer.footer",
        "api::redirect.redirect",
      ]) {
        expect(contentTypes).toContain(uid)
      }
    })
  })

  describe("library content type", () => {
    it("has the core atlas fields", () => {
      const { attributes } = strapi.contentTypes["api::library.library"]

      for (const field of [
        "name",
        "slug",
        "entityRef",
        "libraryType",
        "website",
        "continent",
        "country",
        "region",
      ]) {
        expect(attributes[field as keyof typeof attributes]).toBeDefined()
      }
    })
  })

  describe("security-sensitive schema", () => {
    it("keeps saved-event owner ids out of API responses", () => {
      const { attributes } = strapi.contentTypes["api::saved-event.saved-event"]
      expect((attributes as any).baUserId?.private).toBe(true)
    })

    it("disables users-permissions self-registration at bootstrap", async () => {
      const advanced = (await strapi
        .store({ type: "plugin", name: "users-permissions", key: "advanced" })
        .get()) as { allow_register?: boolean } | null
      expect(advanced?.allow_register).toBe(false)
    })
  })
})
