import { BadgesSection } from "@/app/[locale]/profile/[username]/_components/sections/BadgesSection"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  profile,
  profileResponses,
  readerSession,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Profile/BadgesSection",
  component: BadgesSection,
  args: {
    username: profile.username,
    points: 124,
    pointsThisMonth: 24,
    streak: 3,
    tier: "reader",
  },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false, height: "800px" } },
  },
} satisfies Meta<typeof BadgesSection>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
