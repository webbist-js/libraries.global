import { createRequire } from "node:module"
import path from "node:path"

// @ts-expect-error vite is provided by Strapi internally
import type { UserConfig } from "vite"

// Resolve Strapi's bundled Vite under pnpm's strict dependency isolation.
const strapiRequire = createRequire(
  require.resolve("@strapi/strapi/package.json")
)
const { mergeConfig } = strapiRequire("vite")

// Third-party admin plugins (config-sync) list @strapi/icons as a peer that
// pnpm never links for them, which breaks the admin's dependency
// optimisation. Point every import at the copy installed for this app.
const icons = path.resolve(__dirname, "../../node_modules/@strapi/icons/dist")

export default (config: UserConfig) => {
  // Important: always return the modified config
  return mergeConfig(config, {
    // Workspace packages resolve outside node_modules. shared-data builds as
    // CommonJS for Strapi's server, so Vite must convert it for the admin too.
    optimizeDeps: {
      include: ["@repo/shared-data"],
      // Linked workspace builds can change without a lockfile change. Vite's
      // cached bundle would otherwise keep old exports across Strapi restarts.
      force: true,
    },
    build: {
      commonjsOptions: {
        include: [/node_modules/, /packages\/shared-data\/dist\//],
      },
    },
    resolve: {
      alias: [
        { find: "@", replacement: "/src" },
        {
          find: /^@strapi\/icons\/symbols$/,
          replacement: path.join(icons, "symbols-index.mjs"),
        },
        {
          find: /^@strapi\/icons$/,
          replacement: path.join(icons, "index.mjs"),
        },
      ],
    },
  } as UserConfig)
}
