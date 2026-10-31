import { OverviewSection } from "@/app/[locale]/profile/[username]/_components/sections/OverviewSection"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  profile,
  profileResponses,
  readerSession,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Profile/OverviewSection",
  component: OverviewSection,
  args: { profile, isOwner: true },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false, height: "800px" } },
  },
} satisfies Meta<typeof OverviewSection>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
