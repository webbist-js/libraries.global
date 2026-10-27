/** Local fixture writer. Run with the HTTP Strapi process stopped. */
const { createRequire } = require("node:module")
const path = require("node:path")

const NETWORK_FIXTURES = [
  {
    slug: "access-fixture-library-service",
    name: "Access Fixture Library Service",
    kind: "library_service",
    publicPageEnabled: true,
  },
  {
    slug: "access-fixture-consortium",
    name: "Access Fixture Consortium",
    kind: "consortium",
    publicPageEnabled: true,
  },
  {
    slug: "access-fixture-unreviewed-service",
    name: "Access Fixture Unreviewed Service",
    kind: "library_service",
    publicPageEnabled: false,
  },
]
const NETWORK = "api::library-network.library-network"
const LIBRARY = "api::library.library"

function assertLocalDatabase(strapi) {
  if (
    process.env.NODE_ENV === "production" ||
    strapi.config.get("environment") === "production"
  )
    throw new Error("Network fixtures require a local development database")
  const connection = strapi.config.get("database.connection.connection") ?? {}
  const hosts = [connection.host ?? "localhost"]
  if (connection.connectionString) {
    const url = new URL(connection.connectionString)
    if (url.searchParams.has("host"))
      throw new Error("Database host overrides are not allowed")
    hosts.push(url.hostname)
  }
  if (
    !hosts.every((host) =>
      ["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)
    )
  )
    throw new Error("Network fixtures require a loopback database")
}

async function seedNetworkFixtures(strapi) {
  assertLocalDatabase(strapi)
  const libraries = await strapi.documents(LIBRARY).findMany({
    filters: {
      slug: {
        $in: ["access-fixture-public-library", "access-fixture-second-library"],
      },
    },
    locale: "en",
    status: "published",
    populate: { country: true, networks: true },
    limit: 2,
  })
  if (libraries.length !== 2)
    throw new Error("Run the access fixture seed first")
  const networks = []
  for (const fixture of NETWORK_FIXTURES) {
    const existing = await strapi
      .documents(NETWORK)
      .findFirst({ filters: { sourceKey: `qa:${fixture.slug}` } })
    const data = {
      ...fixture,
      sourceKey: `qa:${fixture.slug}`,
      description:
        "A fictional service used by the local network journey tests.",
      website: "https://example.test/library-service",
      sourceUrl: "https://example.test/network-register",
      lastVerifiedAt: new Date().toISOString(),
      countries: {
        set: [
          ...new Set(
            libraries.map((row) => row.country?.documentId).filter(Boolean)
          ),
        ],
      },
    }
    const row = existing
      ? await strapi
          .documents(NETWORK)
          .update({ documentId: existing.documentId, data })
      : await strapi.documents(NETWORK).create({ data })
    networks.push(row)
  }
  for (const library of libraries) {
    const ids = [
      ...new Set([
        ...(library.networks ?? []).map((row) => row.documentId),
        ...networks.map((row) => row.documentId),
      ]),
    ]
    await strapi.documents(LIBRARY).update({
      documentId: library.documentId,
      locale: "en",
      data: { networks: { set: ids } },
    })
    await strapi
      .documents(LIBRARY)
      .publish({ documentId: library.documentId, locale: "en" })
  }

  return {
    networks: networks.map(({ documentId, slug }) => ({ documentId, slug })),
  }
}

async function main() {
  const appDir = path.resolve(__dirname, "../../../../apps/strapi")
  const requireFromStrapi = createRequire(path.join(appDir, "package.json"))
  const { createStrapi } = requireFromStrapi("@strapi/strapi")
  const instance = createStrapi({ appDir, distDir: path.join(appDir, "dist") })
  assertLocalDatabase(instance)
  instance.config.set("server.cron.enabled", false)
  const strapi = await instance.load()
  strapi.cron?.destroy?.()
  try {
    await seedNetworkFixtures(strapi)
    process.stdout.write("Network fixtures ready\n")
  } finally {
    await strapi.destroy()
  }
}
module.exports = { NETWORK_FIXTURES, seedNetworkFixtures }
// This CLI must release bootstrap timers even when Strapi fails mid-load.
/* eslint-disable unicorn/no-process-exit */
if (require.main === module)
  main()
    .then(() => process.exit(0))
    .catch(() => {
      process.stderr.write(
        "Network fixture setup failed; check the local configuration\n"
      )
      process.exit(1)
    })
