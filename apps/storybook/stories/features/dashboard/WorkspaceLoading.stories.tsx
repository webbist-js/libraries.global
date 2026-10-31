import { WorkspaceLoading } from "@/components/dashboard/DashboardLoading"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  profileResponses,
  readerSession,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Dashboard/WorkspaceLoading",
  component: WorkspaceLoading,
  args: {},
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof WorkspaceLoading>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
