import type * as Preset from "@docusaurus/preset-classic"
import type { Config, Plugin } from "@docusaurus/types"
import { themes as prismThemes } from "prism-react-renderer"

const url = process.env.DOCUSAURUS_URL ?? "https://libraries.global"
const baseUrl = process.env.DOCUSAURUS_BASE_URL ?? "/"

const config: Config = {
  plugins: [
    function quietWebpackProgress(): Plugin {
      return {
        name: "quiet-webpack-progress",
        configureWebpack(webpackConfig) {
          // Docusaurus 3.9's webpackbar passes options rejected by webpack 5.109.
          // Keep compilation/checks intact while omitting the cosmetic reporter.
          return {
            mergeStrategy: { plugins: "replace" },
            plugins: webpackConfig.plugins?.filter(
              (plugin) => plugin?.constructor.name !== "WebpackBarPlugin"
            ),
          }
        },
      }
    },
    [
      require.resolve("@easyops-cn/docusaurus-search-local"),
      {
        hashed: true,
        indexDocs: true,
        indexBlog: false,
        docsRouteBasePath: "/docs",
      },
    ],
  ],
  organizationName: "libraries-global",
  projectName: "libraries-global",
  title: "Libraries Global",
  tagline: "Developer documentation for Libraries Global",
  url,
  baseUrl,
  onBrokenLinks: "throw",
  favicon: undefined,
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: "throw",
    },
  },

  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          editUrl:
            "https://github.com/webbist-js/libraries.global/edit/dev/apps/docs/",
          routeBasePath: "docs",
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    navbar: {
      title: "Libraries Global Docs",
      items: [
        {
          type: "docSidebar",
          sidebarId: "docs",
          position: "left",
          label: "Docs",
        },
      ],
    },
    footer: {
      style: "dark",
      copyright: `Copyright © ${new Date().getFullYear()} Libraries Global. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.oneLight,
      darkTheme: prismThemes.oneDark,
      additionalLanguages: ["bash", "json", "typescript"],
    },
  } satisfies Preset.ThemeConfig,
}

export default config
