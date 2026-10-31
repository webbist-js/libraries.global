import { TeamOrganiser } from "@/components/staff/TeamOrganiser"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { team, billingResponses } from "../../fixtures/workspace/staff"

const meta = {
  title: "Features/Staff/TeamOrganiser",
  component: TeamOrganiser,
  args: { team },
  parameters: {
    fixtureResponses: billingResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof TeamOrganiser>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
