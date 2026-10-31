import { WidgetsStaffPage } from "@/components/widgets/WidgetsStaffPage"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { asyncStory } from "../../../.storybook/AsyncStory"
import { readerSession } from "../../fixtures/workspace/profile"
import { widgetWorkspace } from "../../fixtures/workspace/widgets"

const meta = {
  title: "Features/Widgets/WidgetsStaffPage",
  component: WidgetsStaffPage,
  render: asyncStory(WidgetsStaffPage),
  args: {},
  parameters: {
    react: { rsc: true },
    fixtureSession: {
      ...readerSession,
      user: {
        ...readerSession.user,
        teams: [
          {
            id: "example-team",
            name: "Example Library Team",
            slug: "example-library-team",
            role: "organiser",
            libraryCount: 3,
            status: "active",
          },
        ],
      },
    },
    serverFixtures: {
      "staff.fetchStaff": { status: 200, body: widgetWorkspace },
    },
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof WidgetsStaffPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const MembershipAccess: Story = {
  parameters: {
    fixtureSession: readerSession,
    docs: { story: { inline: false } },
  },
}
