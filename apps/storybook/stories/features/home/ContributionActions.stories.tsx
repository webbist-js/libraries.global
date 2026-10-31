import { ContributionActions } from "@/components/home/ContributionActions"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Home/ContributionActions",
  component: ContributionActions,
  args: {
    memberLabel: "Add a library",
    memberHref: "/contribute/index/new",
    secondaryAction: (
      <a href="/knowledge/contributing">Read the contribution guide</a>
    ),
  },
  decorators: [
    (Story) => (
      <div data-homepage>
        <Story />
      </div>
    ),
  ],
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof ContributionActions>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
