import { FollowingSection } from "@/app/[locale]/profile/[username]/_components/sections/FollowingSection"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  profile,
  profileResponses,
  readerSession,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Profile/FollowingSection",
  component: FollowingSection,
  args: {
    username: profile.username,
    followedLibraries: profile.followedLibraries!,
    followedUsers: profile.followedProfiles!,
  },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false, height: "800px" } },
  },
} satisfies Meta<typeof FollowingSection>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
