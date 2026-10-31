import { ProfileDrawerTrigger } from "@/components/profile/ProfileDrawerTrigger"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  profile,
  profileResponses,
  readerSession,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Profile/ProfileDrawerTrigger",
  component: ProfileDrawerTrigger,
  args: {
    user: readerSession.user,
    profileSnippet: { username: profile.username, profileBackground: "violet" },
  },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof ProfileDrawerTrigger>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
