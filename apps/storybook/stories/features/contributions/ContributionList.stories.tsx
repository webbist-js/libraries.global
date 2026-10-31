import { ContributionList } from "@/components/contributions/ContributionList"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { contributions } from "../../fixtures/public/community"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Contributions/ContributionList",
  component: ContributionList,
  args: {
    title: "Your contributions",
    items: contributions,
    filters: [
      { id: "all", label: "All" },
      { id: "approved", label: "Approved" },
    ],
    matches: (item, filter) => filter === "all" || item.status === filter,
    legend: "Status",
    intro: "Approved contributions appear on your public profile.",
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof ContributionList>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { items: [] } }
