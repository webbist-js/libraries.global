import { ArticlePreview } from "@/components/contribute/article-editor/ArticlePreview"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { articleDraft } from "../../fixtures/public/editor"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Contribute/ArticlePreview",
  component: ArticlePreview,
  args: {
    kind: "knowledge",
    title: articleDraft.title,
    summary: articleDraft.summary,
    doc: articleDraft.doc,
    sources: articleDraft.sources,
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof ArticlePreview>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Compact: Story = { args: { compact: true } }
export const Journal: Story = { args: { kind: "journal" } }
