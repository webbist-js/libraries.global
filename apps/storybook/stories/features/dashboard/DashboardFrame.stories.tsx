import { DashboardFrame } from "@/components/dashboard/DashboardFrame"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  profileResponses,
  readerSession,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Dashboard/DashboardFrame",
  component: DashboardFrame,
  args: {
    navigation: (
      <nav aria-label="Example global navigation">
        <a href="/libraries">Libraries</a>
      </nav>
    ),
    children: (
      <p className="p-6">
        A workspace with global navigation and transient panels.
      </p>
    ),
  },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof DashboardFrame>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
