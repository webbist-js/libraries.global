import { ContributionRow } from "@/components/contributions/ContributionRow"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { contributions } from "../../fixtures/public/community"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Contributions/ContributionRow",
  component: ContributionRow,
  args: { item: contributions[0]!, points: 10 },
  decorators: [
    (Story) => (
      <ul className="m-0 list-none p-0">
        <Story />
      </ul>
    ),
  ],
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof ContributionRow>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const NeedsInformation: Story = {
  args: {
    item: { ...contributions[0]!, status: "needs_info" },
    points: null,
    note: { tone: "warn", text: "Please add a public source." },
  },
}
