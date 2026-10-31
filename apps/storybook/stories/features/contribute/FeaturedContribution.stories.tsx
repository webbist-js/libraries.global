import { FeaturedContribution } from "@/components/contribute/FeaturedContribution"
import { Button } from "@/components/ui/button"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Contribute/FeaturedContribution",
  component: FeaturedContribution,
  args: {
    title: "Help keep opening hours current",
    description: "A quick check makes the next visit easier for everyone.",
    action: <Button>Check opening hours</Button>,
    steps: [
      "Choose a library",
      "Check its official website",
      "Suggest any changes",
    ],
    next: "An editor reviews your suggestion before publication.",
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof FeaturedContribution>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
