import { DocsPage } from "@/components/docs/DocsPage"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { discovery } from "../../fixtures/public/articles"
import {
  knowledgeSections,
  wikiArticles,
} from "../../fixtures/public/knowledge"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Docs/DocsPage",
  component: DocsPage,
  args: {
    articles: wikiArticles,
    sections: knowledgeSections,
    locale: "en",
    quickStartCards: wikiArticles,
    discovery,
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
} satisfies Meta<typeof DocsPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
