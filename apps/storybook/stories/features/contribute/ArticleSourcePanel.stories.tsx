import { ArticleSourcePanel } from "@/components/contribute/article-editor/ArticleSourcePanel"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { editorLocales, existingArticle } from "../../fixtures/public/editor"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Contribute/ArticleSourcePanel",
  component: ArticleSourcePanel,
  args: { article: existingArticle, locales: editorLocales },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof ArticleSourcePanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
