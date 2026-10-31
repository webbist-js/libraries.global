import { ArticlePreview } from "@/components/contribute/article-editor/ArticlePreview"
import { ArticleReadingPane } from "@/components/contribute/article-editor/ArticleReadingPane"
import { HowEditingWorks } from "@/components/contribute/article-editor/ArticleSidebar"
import {
  ArticleWorkspaceLayout,
  ArticleWorkspaceSidebar,
} from "@/components/contribute/article-editor/ArticleWorkspaceLayout"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { articleDraft } from "../../fixtures/public/editor"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Contribute/ArticleWorkspaceLayout",
  component: ArticleWorkspaceLayout,
  args: {
    wide: true,
    children: (
      <>
        <ArticleReadingPane heading="Editor" lang="en">
          <ArticlePreview
            kind="knowledge"
            title={articleDraft.title}
            summary={articleDraft.summary}
            doc={articleDraft.doc}
          />
        </ArticleReadingPane>
        <ArticleWorkspaceSidebar wide>
          <HowEditingWorks publishesDirectly={false} />
        </ArticleWorkspaceSidebar>
      </>
    ),
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof ArticleWorkspaceLayout>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Narrow: Story = { args: { wide: false } }
