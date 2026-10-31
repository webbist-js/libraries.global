import { YourTeamCard } from "@/components/staff/YourTeamCard"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  readerSession,
  profileResponses,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Staff/YourTeamCard",
  component: YourTeamCard,
  args: {},
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof YourTeamCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
