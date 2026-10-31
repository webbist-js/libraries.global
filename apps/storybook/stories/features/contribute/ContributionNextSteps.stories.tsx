import { ContributionNextSteps } from "@/components/contribute/ContributionNextSteps"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Contribute/ContributionNextSteps",
  component: ContributionNextSteps,
  args: {},
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof ContributionNextSteps>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const CustomSteps: Story = {
  args: {
    steps: [
      "Add a reliable source",
      "Preview your changes",
      "Send your suggestion for review",
    ],
  },
}
