import { ProfileHero } from "@/app/[locale]/profile/[username]/_components/ProfileHero"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  profile,
  profileResponses,
  readerSession,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Profile/ProfileHero",
  component: ProfileHero,
  args: { profile, isOwnProfile: false, isSignedIn: true },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false, height: "800px" } },
  },
} satisfies Meta<typeof ProfileHero>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const OwnProfile: Story = { args: { isOwnProfile: true } }
