import { ArticlePreview } from "@/components/contribute/article-editor/ArticlePreview"
import { ArticleReadingPane } from "@/components/contribute/article-editor/ArticleReadingPane"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { articleDraft } from "../../fixtures/public/editor"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Contribute/ArticleReadingPane",
  component: ArticleReadingPane,
  args: {
    heading: "Published article",
    lang: "en",
    children: (
      <ArticlePreview
        kind="knowledge"
        title={articleDraft.title}
        summary={articleDraft.summary}
        doc={articleDraft.doc}
      />
    ),
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof ArticleReadingPane>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
