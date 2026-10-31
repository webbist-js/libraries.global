import { ArticleEditHistory } from "@/components/docs/ArticleEditHistory"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { articleHistory } from "../../fixtures/public/knowledge"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Docs/ArticleEditHistory",
  component: ArticleEditHistory,
  args: { items: articleHistory, total: 2, locale: "en" },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof ArticleEditHistory>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { items: [], total: 0 } }
