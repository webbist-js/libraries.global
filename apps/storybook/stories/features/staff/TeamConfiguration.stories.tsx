import { TeamConfiguration } from "@/components/staff/TeamConfiguration"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { team, staffResponses } from "../../fixtures/workspace/staff"

const meta = {
  title: "Features/Staff/TeamConfiguration",
  component: TeamConfiguration,
  args: { team },
  parameters: {
    fixtureResponses: staffResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof TeamConfiguration>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
