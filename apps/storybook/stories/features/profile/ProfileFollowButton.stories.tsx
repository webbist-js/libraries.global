import { ProfileFollowButton } from "@/app/[locale]/profile/[username]/_components/ProfileFollowButton"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  profileResponses,
  readerSession,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Profile/ProfileFollowButton",
  component: ProfileFollowButton,
  args: { targetUsername: "example-ben", isSignedIn: true },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false, height: "800px" } },
  },
} satisfies Meta<typeof ProfileFollowButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const SignedOut: Story = { args: { isSignedIn: false } }
