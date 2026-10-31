import { ArticleDiscoveryFilters } from "@/components/articles/ArticleDiscoveryFilters"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { discovery } from "../../fixtures/public/articles"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Articles/ArticleDiscoveryFilters",
  component: ArticleDiscoveryFilters,
  args: { discovery, kind: "journal" },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof ArticleDiscoveryFilters>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Compact: Story = { args: { compact: true } }
export const Toolbar: Story = { args: { toolbar: true } }
