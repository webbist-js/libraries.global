import { KnowledgeBrowsePagination } from "@/components/articles/KnowledgeBrowsePagination"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Articles/KnowledgeBrowsePagination",
  component: KnowledgeBrowsePagination,
  args: { page: 2, pageCount: 5 },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof KnowledgeBrowsePagination>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
