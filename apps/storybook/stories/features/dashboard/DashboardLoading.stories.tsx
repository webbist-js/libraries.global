import { DashboardLoading } from "@/components/dashboard/DashboardLoading"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  profileResponses,
  readerSession,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Dashboard/DashboardLoading",
  component: DashboardLoading,
  args: {},
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof DashboardLoading>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
