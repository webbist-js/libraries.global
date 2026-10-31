import { ProfileTabNav } from "@/app/[locale]/profile/[username]/_components/ProfileTabNav"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  profile,
  profileResponses,
  readerSession,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Profile/ProfileTabNav",
  component: ProfileTabNav,
  args: {
    username: profile.username,
    isOwnProfile: true,
    counts: { contributions: 12, following: 3 },
  },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false, height: "800px" } },
  },
} satisfies Meta<typeof ProfileTabNav>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
