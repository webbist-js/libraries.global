import { TeamJoin } from "@/app/[locale]/(dashboard)/staff/teams/join/[token]/_components/TeamJoin"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Staff/TeamJoin",
  component: TeamJoin,
  args: {
    token: "synthetic-invite",
    invite: {
      teamName: "Example Library Team",
      teamRole: "member",
      invitedByName: "Maya S.",
      emailMasked: "m***@example.invalid",
      emailMatches: true,
      status: "open",
      preassign: null,
    },
    emailVerified: true,
  },
} satisfies Meta<typeof TeamJoin>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
