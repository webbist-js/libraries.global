import { DocsArticlePage } from "@/components/docs/DocsArticlePage"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  knowledgeSections,
  wikiArticle,
  wikiArticles,
} from "../../fixtures/public/knowledge"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Docs/DocsArticlePage",
  component: DocsArticlePage,
  args: {
    article: wikiArticle,
    articles: wikiArticles,
    sections: knowledgeSections,
    section: knowledgeSections[0]!,
    locale: "en",
  },
  parameters: {
    docs: {
      story: { inline: false, iframeHeight: 900 },
      description: {
        component:
          "This example runs in its own iframe to keep fixture requests, caches and page landmarks independent. Open Canvas to use the interactive Controls.",
      },
    },
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
    react: { rsc: true },
  },
} satisfies Meta<typeof DocsArticlePage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
