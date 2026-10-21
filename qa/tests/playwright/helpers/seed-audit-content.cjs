/** Synthetic content for the browser acceptance database. Never run on ordinary content. */
const fs = require("node:fs")
const { createRequire } = require("node:module")
const path = require("node:path")

const root = path.resolve(__dirname, "../../../..")
const appDir = path.join(root, "apps/strapi")
if (process.env.NODE_ENV === "production")
  throw new Error("Refusing production fixture setup")
if (!process.env.ACCESS_STRAPI_ENV_PATH)
  throw new Error(
    "Set ACCESS_STRAPI_ENV_PATH to a disposable local CMS environment"
  )
process.env.ENV_PATH = process.env.ACCESS_STRAPI_ENV_PATH
process.chdir(appDir)
const fromStrapi = createRequire(path.join(appDir, "package.json"))
const { createStrapi } = fromStrapi("@strapi/strapi")

const admins = [
  ["QA_ADMIN", "Audit", "Manager", "strapi-super-admin"],
  ["QA_READONLY", "Audit", "Reader", "audit-readonly"],
]

function assertFixtureTarget(s) {
  const search = new URL(process.env.MEILISEARCH_HOST)
  if (
    process.env.QA_AUDIT_ISOLATED_SERVICES !== "1" ||
    !["http:", "https:"].includes(search.protocol) ||
    !["localhost", "127.0.0.1", "::1", "[::1]"].includes(search.hostname)
  )
    throw new Error(
      "Confirm a disposable local search service with QA_AUDIT_ISOLATED_SERVICES=1"
    )
  const connection = s.config.get("database.connection.connection")
  const url = connection.connectionString
    ? new URL(connection.connectionString)
    : null
  const host = url?.hostname ?? connection.host
  const database = url ? url.pathname.slice(1) : connection.database
  if (
    !["localhost", "127.0.0.1", "::1", "[::1]"].includes(host) ||
    url?.searchParams.has("host") ||
    !/^lg_audit_[a-z0-9_]+$/.test(database)
  )
    throw new Error("Refusing: use a loopback database named lg_audit_<name>")
  for (const [prefix] of admins)
    if (
      !process.env[`${prefix}_EMAIL`]?.endsWith("@example.test") ||
      !process.env[`${prefix}_PASSWORD`]
    )
      throw new Error(`Set synthetic ${prefix}_EMAIL and ${prefix}_PASSWORD`)
}

async function seedAdmins(s) {
  let reader = await s.db
    .query("admin::role")
    .findOne({ where: { code: "audit-readonly" } })
  if (!reader)
    reader = await s.db.query("admin::role").create({
      data: {
        name: "Audit read only",
        code: "audit-readonly",
        description: "Synthetic browser fixture: read only.",
      },
    })
  await s.service("admin::role").assignPermissions(
    reader.id,
    ["events", "rewards", "discussions"].map((plugin) => ({
      action: `plugin::${plugin}.read`,
      subject: null,
      properties: {},
      conditions: [],
    }))
  )
  for (const [prefix, firstname, lastname, code] of admins) {
    const email = process.env[`${prefix}_EMAIL`]
    const role = await s.db.query("admin::role").findOne({ where: { code } })
    const existing = await s.db
      .query("admin::user")
      .findOne({ where: { email } })
    if (!existing)
      await s.db.query("admin::user").create({
        data: {
          email,
          firstname,
          lastname,
          password: await s
            .service("admin::auth")
            .hashPassword(process.env[`${prefix}_PASSWORD`]),
          isActive: true,
          registrationToken: null,
          roles: [role.id],
        },
      })
  }
}

async function seed() {
  const s = createStrapi({ appDir, distDir: path.join(appDir, "dist") })
  assertFixtureTarget(s)
  s.config.set("server.cron.enabled", false)
  await s.load()
  s.cron.destroy()
  try {
    const doc = async (uid, data, publish = true) => {
      const old = await s
        .documents(uid)
        .findFirst({ filters: { slug: data.slug }, locale: "en" })
      if (old)
        return s.documents(uid).update({
          documentId: old.documentId,
          locale: "en",
          ...(publish ? { status: "published" } : {}),
          data,
        })

      return s.documents(uid).create({
        locale: "en",
        ...(publish ? { status: "published" } : {}),
        data,
      })
    }
    const continent = await doc("api::continent.continent", {
      name: "North America",
      slug: "north-america",
      code: "NA",
    })
    const country = await doc("api::country.country", {
      name: "United States",
      slug: "united-states",
      iso2: "US",
      iso3: "USA",
      continent: continent.documentId,
    })
    const region = await doc("api::region.region", {
      name: "Illinois",
      slug: "illinois",
      country: country.documentId,
      continent: continent.documentId,
    })
    const area = await doc("api::area.area", {
      name: "Cook County",
      slug: "cook-county",
      region: region.documentId,
      country: country.documentId,
      continent: continent.documentId,
    })
    const europe = await doc("api::continent.continent", {
      name: "Europe",
      slug: "europe",
      code: "EU",
    })
    const england = await doc("api::country.country", {
      name: "England",
      slug: "england",
      iso2: "GB-ENG",
      iso3: "GBR-ENG",
      continent: europe.documentId,
    })
    const cornwall = await doc("api::region.region", {
      name: "Cornwall",
      slug: "cornwall",
      country: england.documentId,
      continent: europe.documentId,
    })
    const libraryType = await s
      .documents("api::library-type.library-type")
      .findFirst({ filters: { name: "Public" } })
    for (let i = 1; i <= 5; i++)
      await doc("api::library.library", {
        name: `Audit Library ${i}`,
        slug: `audit-library-${i}`,
        entityRef: `audit:library:${i}`,
        summary: "A synthetic public library for browser acceptance.",
        country: country.documentId,
        continent: continent.documentId,
        region: region.documentId,
        area: area.documentId,
        libraryType: libraryType.documentId,
        location: { lat: 41.88 + i / 100, lng: -87.63 },
        city: "Chicago",
        postalCode: "60601",
        streetAddress: "1 Example Street",
        operationalStatus: "open",
      })
    await doc("api::library.library", {
      name: "Audit Cornwall Library",
      slug: "audit-cornwall-library",
      entityRef: "audit:cornwall:1",
      country: england.documentId,
      continent: europe.documentId,
      region: cornwall.documentId,
      libraryType: libraryType.documentId,
      location: { lat: 50.15, lng: -5.07 },
      operationalStatus: "open",
    })
    for (const [uid, title, slug] of [
      [
        "api::wiki-article.wiki-article",
        "How to contribute",
        "how-to-contribute",
      ],
      ["api::blog-article.blog-article", "Welcome", "welcome"],
    ])
      await doc(uid, {
        title,
        slug,
        summary: "Synthetic editorial fixture for local acceptance.",
        author: "Audit Editor",
        body: [
          {
            __component: "content.rich-text",
            content:
              "<p>Help improve library records through reviewed contributions.</p>",
          },
        ],
      })
    await doc(
      "api::drive.drive",
      {
        title: "Audit opening hours",
        slug: "audit-opening-hours",
        summary: "Add opening hours to synthetic local library records.",
        focus: { kind: "gaps", gaps: ["hours"] },
        scope: { places: { area: [area.slug] } },
        startsAt: "2026-01-01T00:00:00.000Z",
        endsAt: "2099-01-01T00:00:00.000Z",
        status: "open",
        steps: [{ text: "Find a library and add its opening hours." }],
      },
      false
    )

    const home = await s
      .documents("api::homepage.homepage")
      .findFirst({ locale: "en" })
    await s
      .documents("api::homepage.homepage")
      [
        home ? "update" : "create"
      ]({ ...(home ? { documentId: home.documentId } : {}), locale: "en", status: "published", data: { heroTitle: "Every library, *on one map.*" } })
    await seedAdmins(s)
    const publicRole = await s.db
      .query("plugin::users-permissions.role")
      .findOne({ where: { type: "public" } })
    for (const type of [
      "library",
      "continent",
      "country",
      "region",
      "area",
      "library-type",
      "wiki-article",
      "blog-article",
      "wiki-section",
      "category",
      "homepage",
      "footer",
      "navbar",
      "legal-document",
      "drive",
    ])
      for (const method of ["find", "findOne"]) {
        const action = `api::${type}.${type}.${method}`
        if (
          !(await s.db
            .query("plugin::users-permissions.permission")
            .findOne({ where: { action, role: publicRole.id } }))
        )
          await s.db
            .query("plugin::users-permissions.permission")
            .create({ data: { action, role: publicRole.id } })
      }
    // Dates in the public visual fixtures must not change with the seed day.
    for (const uid of [
      "api::wiki-article.wiki-article",
      "api::blog-article.blog-article",
    ])
      await s.db.query(uid).updateMany({
        where: { publishedAt: { $notNull: true } },
        data: {
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          publishedAt: "2026-01-01T00:00:00.000Z",
        },
      })
    await s.plugin("meilisearch").service("store").syncCredentials()
    for (const contentType of [
      "api::library.library",
      "api::wiki-article.wiki-article",
      "api::blog-article.blog-article",
      "plugin::events.event",
    ])
      await s
        .plugin("meilisearch")
        .service("meilisearch")
        .addContentTypeInMeiliSearch({ contentType })
    const token = await s.service("admin::api-token").create({
      name: `Local audit read ${Date.now()}`,
      type: "read-only",
      lifespan: null,
    })
    const output = path.join(root, ".scratch/audit-qa/fixture-keys.json")
    fs.mkdirSync(path.dirname(output), { recursive: true })
    fs.writeFileSync(
      output,
      JSON.stringify({
        STRAPI_SEED_TOKEN: token.accessKey,
        STRAPI_REST_READONLY_API_KEY: token.accessKey,
        STRAPI_REST_CUSTOM_API_KEY: token.accessKey,
      }),
      { mode: 0o600 }
    )
    process.stdout.write(
      "Synthetic audit content ready. Read-only fixture keys saved under ignored .scratch/audit-qa/.\n"
    )
  } finally {
    await s.destroy()
  }
}
seed().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
