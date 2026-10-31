import { ArticleRevisionComparison } from "@/components/contribute/article-editor/ArticleRevisionComparison"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import { articleDraft } from "../../fixtures/public/editor"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Contribute/ArticleRevisionComparison",
  component: ArticleRevisionComparison,
  args: {
    kind: "knowledge",
    draftLocale: "en",
    draft: articleDraft,
    published: {
      ...articleDraft,
      title: "A welcome for every reader",
      revision: "example-published-revision",
      locale: "en",
    },
    busy: false,
    onAdopt: fn(),
    onBack: fn(),
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof ArticleRevisionComparison>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Busy: Story = { args: { busy: true } }
