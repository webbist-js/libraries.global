import { MembershipSettingsLink } from "@/components/membership/MembershipSettingsLink"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { readerSession } from "../../../.storybook/FixtureSession"

const meta = {
  title: "Features/Membership/MembershipSettingsLink",
  component: MembershipSettingsLink,
  parameters: {
    fixtureSession: readerSession,
    docs: { story: { inline: false, height: "900px" } },
  },
} satisfies Meta<typeof MembershipSettingsLink>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
