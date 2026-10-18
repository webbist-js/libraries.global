import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { applyArticleSubmission } from "../../src/plugins/content-moderation/server/utils/article-apply"
import { resetLocalesMemo } from "../../src/plugins/content-moderation/server/utils/locales"
import { publicArticleBrowseItem } from "../../src/utils/article-browse"
import {
  ARTICLE_BODY_POPULATE,
  articleRevision,
} from "../../src/utils/article-content"
import { setupStrapi, strapi, teardownStrapi } from "../helpers/strapi"

const suffix = randomUUID().replaceAll("-", "").slice(0, 12)
const BLOG = "api::blog-article.blog-article"
const LIBRARY = "api::library.library"
const SECTION = "api::blog-section.blog-section"
const uid = (kind: string) => `api::${kind}.${kind}`
const writerId = `relation-writer-${suffix}`
const created: { uid: string; documentId: string }[] = []
const projectionIds = new Set<number>()
const body = [
  {
    __component: "content.rich-text",
    body: [
      {
        type: "paragraph",
        children: [
          { type: "text", text: "Una visita a la biblioteca de Colombia." },
        ],
      },
    ],
  },
]
const populate = {
  section: true,
  topics: true,
  libraries: true,
  continents: true,
  countries: true,
  regions: true,
  areas: true,
  eventMentions: { populate: { library: true, event: true } },
  body: ARTICLE_BODY_POPULATE,
}

describe.skipIf(process.env.COMMUNITY_RELATION_INTEGRATION !== "1")(
  "Spanish article relations on the full Strapi host",
  () => {
    let ready = false
    let cms: any
    let library: any
    let places: any[]
    let section: any
    let translatedSection: any
    let topic: any
    let event: any

    const create = async (
      target: string,
      data: Record<string, unknown>,
      locale?: string,
      status?: string
    ) => {
      let row: any
      try {
        row = await strapi.documents(target as any).create({
          data: data as any,
          ...(locale ? { locale } : {}),
          ...(status ? { status } : {}),
        } as any)
      } catch (error) {
        throw new Error(`Relation fixture creation failed for ${target}`, {
          cause: error,
        })
      }
      created.push({ uid: target, documentId: row.documentId })

      return row
    }
    const read = async (documentId: string) => {
      const article = (await strapi.documents(BLOG).findOne({
        documentId,
        locale: "es",
        status: "published",
        populate: populate as any,
      })) as any
      if (article?.id) projectionIds.add(article.id)

      return article
    }
    const story = async (home: any) => {
      const submission = {
        documentId: `submission-${randomUUID()}`,
        submittedByUserId: writerId,
        contentLocale: "es",
        draftData: {
          kind: "new_article",
          title: `Visita a Colombia ${home.slug} ${suffix}`,
          body,
          sections: [home.slug],
          tags: [
            {
              kind: "library",
              label: library.name,
              documentId: library.documentId,
            },
            { kind: "topic", label: topic.name, slug: topic.slug },
            ...places.map((place, index) => ({
              kind: ["continent", "country", "region", "area"][index],
              label: place.name,
              documentId: place.documentId,
            })),
          ],
          eventMentions: [{ eventDocumentId: event.documentId }],
        },
      }
      expect(
        await applyArticleSubmission(strapi, submission, "journal", {
          onCreated: (documentId) => created.push({ uid: BLOG, documentId }),
        })
      ).toBe("created_published")

      const article = (await strapi.documents(BLOG).findFirst({
        locale: "es",
        status: "published",
        filters: { title: { $eq: submission.draftData.title } },
        populate: populate as any,
      })) as any
      if (article?.id) projectionIds.add(article.id)

      return article
    }

    beforeAll(async () => {
      const contents = readFileSync(".env", "utf8")
      const value = (name: string) =>
        process.env[name] ??
        contents
          .split("\n")
          .find((line) => line.startsWith(`${name}=`))
          ?.slice(name.length + 1)
          .replaceAll(/^['"]|['"]$/g, "")
      if (
        !["127.0.0.1", "localhost"].includes(value("DATABASE_HOST") ?? "") ||
        value("DATABASE_PORT") !== "5433" ||
        value("DATABASE_NAME") !== "community_publishing_acceptance"
      )
        throw new Error(
          "Relation integration requires the isolated local community publishing acceptance database"
        )
      cms = (await setupStrapi()).instance
      ready = true
      const locales = strapi.plugin("i18n").service("locales")
      if (!(await locales.find()).some((locale: any) => locale.code === "es"))
        await locales.create({ code: "es", name: "Spanish (es)" })
      resetLocalesMemo(strapi)
      await create("api::user-profile.user-profile", {
        baUserId: writerId,
        username: `rel_${suffix}`,
        profileVisibility: "public",
        publicPrefs: { showActivity: true },
      })
      await create("api::role-grant.role-grant", {
        baUserId: writerId,
        role: "journal_editor",
        source: "migration",
        queue: "all",
        scopeLocale: "es",
      })
      const continent = await create(
        uid("continent"),
        { name: `South America ${suffix}`, slug: `south-america-${suffix}` },
        "en",
        "published"
      )
      const country = await create(
        uid("country"),
        {
          name: `Colombia ${suffix}`,
          slug: `colombia-${suffix}`,
          continent: { connect: [{ documentId: continent.documentId }] },
        },
        "en",
        "published"
      )
      const region = await create(
        uid("region"),
        {
          name: `Bogota region ${suffix}`,
          slug: `bogota-region-${suffix}`,
          country: { connect: [{ documentId: country.documentId }] },
          continent: { connect: [{ documentId: continent.documentId }] },
        },
        "en",
        "published"
      )
      const area = await create(
        uid("area"),
        {
          name: `Bogota area ${suffix}`,
          slug: `bogota-area-${suffix}`,
          country: { connect: [{ documentId: country.documentId }] },
          region: { connect: [{ documentId: region.documentId }] },
        },
        "en",
        "published"
      )
      places = [continent, country, region, area]
      library = await create(
        LIBRARY,
        {
          name: `Colombia Library ${suffix}`,
          slug: `colombia-library-${suffix}`,
          entityRef: `relation-${suffix}`,
          libraryType: "Public",
          continent: { connect: [{ documentId: continent.documentId }] },
          country: { connect: [{ documentId: country.documentId }] },
          region: { connect: [{ documentId: region.documentId }] },
          area: { connect: [{ documentId: area.documentId }] },
        },
        "en",
        "published"
      )
      section = await create(
        SECTION,
        { name: `Reports ${suffix}`, slug: `reports-${suffix}` },
        "en"
      )
      translatedSection = await create(
        SECTION,
        { name: `Features ${suffix}`, slug: `features-${suffix}` },
        "en"
      )
      await strapi.documents(SECTION).update({
        documentId: translatedSection.documentId,
        locale: "es",
        data: { name: `Reportajes ${suffix}`, slug: `reportajes-${suffix}` },
      })
      topic = await create(
        uid("topic"),
        {
          name: `Library visits ${suffix}`,
          slug: `library-visits-${suffix}`,
          status: "approved",
        },
        "en"
      )
      const now = new Date().toISOString()
      event = await create("plugin::events.event", {
        externalId: `relation-${suffix}`,
        sourceProvider: "ical",
        credentialId: 999999,
        syncHash: suffix,
        title: `Taller en Colombia ${suffix}`,
        url: "https://example.test/workshop",
        startTime: now,
        timezone: "America/Bogota",
        importedAt: now,
        lastSeenAt: now,
        library: {
          connect: [
            {
              documentId: library.documentId,
              locale: "en",
              status: "published",
            },
          ],
        },
      })
    }, 60000)

    afterAll(async () => {
      if (ready) {
        await cms.runUserLifecycles("destroy")
        strapi.db.lifecycles.disable()
        try {
          for (const target of created.toReversed())
            await strapi.db
              .query(target.uid as any)
              .deleteMany({ where: { documentId: target.documentId } })
          await strapi.db
            .query("api::article-change.article-change")
            .deleteMany({
              where: {
                articleDocumentId: {
                  $in: created
                    .filter((target) => target.uid === BLOG)
                    .map((target) => target.documentId),
                },
              },
            })
          await strapi.db
            .query("api::notification.notification")
            .deleteMany({ where: { baUserId: writerId } })
          await strapi.db
            .query("api::article-projection-job.article-projection-job")
            .deleteMany({
              where: {
                key: {
                  $in: [...projectionIds].map((id) => `article:${BLOG}:${id}`),
                },
              },
            })
        } finally {
          strapi.db.lifecycles.enable()
        }
      }
      await teardownStrapi()
    }, 30000)

    it("publishes a Spanish story with an English-only Section, Library, Topic, places and Event citation", async () => {
      const article = await story(section)
      expect(article.locale).toBe("es")
      expect(article.section).toMatchObject({
        documentId: section.documentId,
        locale: "en",
      })
      expect(article.libraries).toMatchObject([
        { documentId: library.documentId, locale: "en" },
      ])
      expect(article.topics).toMatchObject([
        { documentId: topic.documentId, locale: "en" },
      ])
      for (const [index, key] of [
        "continents",
        "countries",
        "regions",
        "areas",
      ].entries()) {
        expect(article[key]).toMatchObject([
          { documentId: places[index].documentId, locale: "en" },
        ])
        expect(article.geographyFacet[key]).toMatchObject([
          { documentId: places[index].documentId },
        ])
      }
      expect(article.eventMentions[0]).toMatchObject({
        title: event.title,
        eventDocumentId: event.documentId,
        library: { documentId: library.documentId, locale: "en" },
        event: { documentId: event.documentId },
      })
      const card = publicArticleBrowseItem(article, "blog")!
      expect(card.facets.languages).toEqual([{ value: "es", label: "es" }])
      expect(card.facets.libraries).toMatchObject([
        { value: library.documentId },
      ])
      expect(card.facets.events).toMatchObject([
        { value: article.eventMentions[0].citationId },
      ])
      expect(card.facets.countries).toMatchObject([
        { value: places[1].documentId },
      ])
      for (const target of [library, ...places])
        expect(
          await strapi
            .documents(
              target === library
                ? LIBRARY
                : (uid(
                    ["continent", "country", "region", "area"][
                      places.indexOf(target)
                    ]
                  ) as any)
            )
            .findOne({
              documentId: target.documentId,
              locale: "es",
              status: "published",
            })
        ).toBeNull()
      const before = article.geographyFacet
      const revision = articleRevision(
        await strapi.documents(BLOG).findOne({
          documentId: article.documentId,
          locale: "es",
          status: "published",
          fields: [
            "title",
            "summary",
            "slug",
            "locale",
            "geographyFacet",
            "updatedAt",
          ],
          populate: { body: ARTICLE_BODY_POPULATE } as any,
        })
      )
      expect(
        await applyArticleSubmission(
          strapi,
          {
            documentId: `edit-${suffix}`,
            submittedByUserId: writerId,
            targetSlug: article.slug,
            contentLocale: "es",
            draftData: {
              title: `${article.title} actualizada`,
              baseRevision: revision,
            },
          },
          "journal"
        )
      ).toBe("published")
      const edited = await read(article.documentId)
      expect(edited.section.documentId).toBe(section.documentId)
      expect(edited.libraries[0].documentId).toBe(library.documentId)
      expect(edited.geographyFacet).toEqual(before)
      expect(edited.eventMentions[0].citationId).toBe(
        article.eventMentions[0].citationId
      )
      expect(edited.eventMentions[0].library.documentId).toBe(
        library.documentId
      )
      await strapi
        .documents(BLOG)
        .publish({ documentId: article.documentId, locale: "es" })
      const republished = await read(article.documentId)
      expect(republished.section.documentId).toBe(section.documentId)
      expect(republished.libraries[0].documentId).toBe(library.documentId)
      expect(republished.topics[0].documentId).toBe(topic.documentId)
      expect(republished.geographyFacet).toEqual(before)
      expect(republished.eventMentions[0].library.documentId).toBe(
        library.documentId
      )
      expect(republished.eventMentions[0].citationId).toBe(
        article.eventMentions[0].citationId
      )
    })

    it("prefers a translated Section even when its translated slug differs from the editor key", async () => {
      const article = await story(translatedSection)
      expect(article.section).toMatchObject({
        documentId: translatedSection.documentId,
        locale: "es",
        slug: `reportajes-${suffix}`,
      })
      expect(article.libraries).toMatchObject([
        { documentId: library.documentId, locale: "en" },
      ])
    })
  }
)
