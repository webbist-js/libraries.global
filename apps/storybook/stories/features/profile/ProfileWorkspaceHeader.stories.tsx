import { ProfileWorkspaceHeader } from "@/components/profile/ProfileWorkspaceHeader"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  profile,
  profileResponses,
  readerSession,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Profile/ProfileWorkspaceHeader",
  component: ProfileWorkspaceHeader,
  args: { user: readerSession.user, profile, avatarUrl: null },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof ProfileWorkspaceHeader>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
