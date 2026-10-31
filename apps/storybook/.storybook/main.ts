import { fileURLToPath } from "node:url"

import type { StorybookConfig } from "@storybook/nextjs-vite"
import tailwindcss from "@tailwindcss/vite"

const ui = fileURLToPath(new URL("../../ui/", import.meta.url))
const config: StorybookConfig = {
  stories: ["../stories/**/*.mdx", "../stories/**/*.stories.@(ts|tsx)"],
  // Only fixture assets and these public geographic resources are published.
  // Never expose the UI public root, which includes unrelated application assets.
  staticDirs: [
    "../public",
    { from: "../../ui/public/images/globe", to: "/images/globe" },
    { from: "../../ui/public/atlas", to: "/atlas" },
  ],
  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    "@storybook/addon-vitest",
  ],
  framework: {
    name: "@storybook/nextjs-vite",
    options: {
      nextConfigPath: fileURLToPath(
        new URL("./next.config.mjs", import.meta.url)
      ),
    },
  },
  core: { disableTelemetry: true },
  features: { experimentalRSC: true },
  docs: { defaultName: "Reference" },
  async viteFinal(config) {
    config.define = {
      ...config.define,
      "import.meta.env.STORYBOOK_APPEARANCE": JSON.stringify(
        process.env.STORYBOOK_APPEARANCE === "dark" ? "dark" : "light"
      ),
    }
    config.plugins = [...(config.plugins ?? []), tailwindcss()]
    config.resolve ??= {}
    config.resolve.dedupe = [
      "react",
      "react-dom",
      "next-intl",
      "@tanstack/react-query",
    ]
    // Browser previews replace data/auth boundaries, never production UI components.
    config.resolve.alias = [
      ...Object.entries({
        "@/lib/auth-client": "auth-client.ts",
        "@/lib/strapi-api/content/server": "content-server.ts",
        "@/lib/strapi-api/content/datasets": "datasets.ts",
        "@/lib/staff-proxy": "staff-proxy.ts",
        "@/lib/journal-landing": "journal-landing.ts",
        "@/lib/drives/drive-view-server": "drive-view-server.ts",
        "@/lib/drives/drives-server": "drives-server.ts",
        "@/lib/networks/server": "networks-server.ts",
        "@/lib/auth-server": "auth-server.ts",
        "@/lib/own-profile-server": "own-profile-server.ts",
        "@/lib/env-vars": "env-vars.ts",
        "@/lib/maplibre": "maplibre.ts",
        "next-intl/server": "intl-server.ts",
        "next/headers": "headers.ts",
        "server-only": "server-only.ts",
      }).map(([find, file]) => ({
        find,
        replacement: fileURLToPath(new URL(`./mocks/${file}`, import.meta.url)),
      })),
      {
        find: /^@\/lib\/team-api\/workspace$/,
        replacement: fileURLToPath(
          new URL("./mocks/team-api-workspace.ts", import.meta.url)
        ),
      },
      {
        find: /^@\/lib\/meilisearch$/,
        replacement: fileURLToPath(
          new URL("./mocks/meilisearch.ts", import.meta.url)
        ),
      },
      {
        find: /^@\/lib\/strapi-api$/,
        replacement: fileURLToPath(
          new URL("./mocks/cms-client.ts", import.meta.url)
        ),
      },
      { find: "@", replacement: `${ui}src` },
      ...(Array.isArray(config.resolve.alias)
        ? config.resolve.alias
        : Object.entries(config.resolve.alias ?? {}).map(
            ([find, replacement]) => ({ find, replacement })
          )),
    ]
    // These workspace libraries export CommonJS from dist, outside node_modules.
    config.build ??= {}
    config.build.commonjsOptions = {
      ...config.build.commonjsOptions,
      include: [/node_modules/, /packages\/(?:shared-data|access)\/dist/],
    }
    config.optimizeDeps ??= {}
    config.optimizeDeps.include = [
      ...(config.optimizeDeps.include ?? []),
      "storybook/theming",
      "@storybook/addon-docs/blocks",
      "@repo/shared-data",
      "@repo/access",
      "@repo/ui > @better-auth/passkey/client",
      "@repo/ui > better-auth/client/plugins",
      "@repo/ui > better-auth/react",
      "@repo/ui > @tiptap/core",
      "@repo/ui > @tiptap/pm/state",
      "@repo/ui > @tiptap/extension-blockquote",
      "@repo/ui > @tiptap/extension-code-block",
      "@repo/ui > @tiptap/extension-image",
      "@repo/ui > @tiptap/extensions",
      "@repo/ui > @tanstack/react-table",
      "@repo/ui > @sentry/nextjs",
      "next/form",
    ]
    config.css = { ...config.css, postcss: { plugins: [] } }
    // Do not load the application .env files or expose additional environment prefixes.
    config.envDir = false

    return config
  },
}

export default config
