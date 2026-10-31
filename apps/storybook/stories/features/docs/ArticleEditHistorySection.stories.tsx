import { ArticleEditHistorySection } from "@/components/docs/ArticleEditHistory"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { wikiArticle } from "../../fixtures/public/knowledge"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Docs/ArticleEditHistorySection",
  component: ArticleEditHistorySection,
  args: { kind: "wiki", documentId: wikiArticle.documentId, locale: "en" },
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
} satisfies Meta<typeof ArticleEditHistorySection>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
