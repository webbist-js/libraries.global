import { DashboardPage } from "@/components/dashboard/DashboardPage"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  profileResponses,
  readerSession,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Dashboard/DashboardPage",
  component: DashboardPage,
  args: {
    title: "Northbridge Library",
    children: (
      <p className="p-6">Opening hours, accessibility and record details.</p>
    ),
  },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof DashboardPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
