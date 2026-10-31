import { WorkspaceNavigation } from "@/components/dashboard/WorkspaceNavigation"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  profileResponses,
  readerSession,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Dashboard/WorkspaceNavigation",
  component: WorkspaceNavigation,
  args: {
    tabs: [
      { id: "overview", label: "Overview", href: "/staff" },
      { id: "events", label: "Events", href: "/staff/events", count: 3 },
    ],
    activeId: "overview",
    label: "Library workspace",
  },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof WorkspaceNavigation>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
