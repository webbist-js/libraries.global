import { ContactModalProvider } from "@/components/contact/ContactModalProvider"
import { MembershipDashboard } from "@/components/membership/MembershipDashboard"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { readerSession } from "../../../.storybook/FixtureSession"
import { membershipResponses } from "../../fixtures/workspace/membership"

const meta = {
  title: "Features/Membership/MembershipDashboard",
  component: MembershipDashboard,
  args: {
    plan: "pro",
    source: "paid",
    teams: [],
    asOf: Date.parse("2026-01-15T12:00:00Z"),
    staffCount: 1,
    recognition: { listed: true, badgeVisible: true, visibility: "public" },
    embedded: true,
  },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: membershipResponses,
    docs: { story: { inline: false, height: "1100px" } },
  },
  decorators: [
    (Story) => (
      <ContactModalProvider>
        <Story />
      </ContactModalProvider>
    ),
  ],
} satisfies Meta<typeof MembershipDashboard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
