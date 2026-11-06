import { ContactModalProvider } from "@/components/contact/ContactModalProvider"
import { MembershipDashboard } from "@/components/membership/MembershipDashboard"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { readerSession } from "../../../.storybook/FixtureSession"

const meta = {
  title: "Features/Membership/MembershipDashboard",
  component: MembershipDashboard,
  args: {
    acceptedContributions: 37,
    recentlyActive: true,
    staffLibraries: [
      {
        id: "example-library",
        name: "Northbridge Library",
        slug: "northbridge",
        libraryType: "Public",
        role: "owner",
        canGoLive: true,
      },
    ],
    teams: [
      {
        id: "example-team",
        name: "Northbridge Libraries",
        slug: "northbridge-libraries",
        role: "organiser",
        libraryCount: 4,
      },
    ],
    apiAccounts: [{ teamId: "example-team", role: "organiser", active: true }],
    recognition: { listed: true, badgeVisible: true, visibility: "public" },
    embedded: true,
  },
  parameters: {
    fixtureSession: readerSession,
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

export const Contributor: Story = {}

export const Explorer: Story = {
  args: {
    acceptedContributions: 0,
    recentlyActive: false,
    staffLibraries: [],
    teams: [],
    apiAccounts: [],
  },
}

export const Supporter: Story = {
  args: { acceptedContributions: 142 },
}
