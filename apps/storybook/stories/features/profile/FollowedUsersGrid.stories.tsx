import { FollowedUsersGrid } from "@/app/[locale]/profile/[username]/_components/FollowedUsersGrid"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  profile,
  profileResponses,
  readerSession,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Profile/FollowedUsersGrid",
  component: FollowedUsersGrid,
  args: { users: profile.followedProfiles! },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false, height: "800px" } },
  },
} satisfies Meta<typeof FollowedUsersGrid>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { users: [] } }
