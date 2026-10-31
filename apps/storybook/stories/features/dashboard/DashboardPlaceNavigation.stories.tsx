import { DashboardPlaceNavigation } from "@/components/dashboard/DashboardPage"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  profileResponses,
  readerSession,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Dashboard/DashboardPlaceNavigation",
  component: DashboardPlaceNavigation,
  args: {
    parents: [
      { href: "/libraries", label: "Libraries" },
      { href: "/libraries?q=northbridge", label: "Northbridge" },
    ],
  },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof DashboardPlaceNavigation>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
