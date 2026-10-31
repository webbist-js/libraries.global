import { MostReadCard } from "@/components/blog/MostReadCard"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { articles } from "../../fixtures/public/articles"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Blog/MostReadCard",
  component: MostReadCard,
  args: { articles, locale: "en" },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof MostReadCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { articles: [] } }
