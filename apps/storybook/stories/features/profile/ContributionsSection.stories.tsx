import { ContributionsSection } from "@/app/[locale]/profile/[username]/_components/sections/ContributionsSection"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  profile,
  profileResponses,
  readerSession,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Profile/ContributionsSection",
  component: ContributionsSection,
  args: { username: profile.username, isOwner: true },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false, height: "800px" } },
  },
} satisfies Meta<typeof ContributionsSection>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
