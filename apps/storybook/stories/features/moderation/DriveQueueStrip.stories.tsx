import { DriveQueueStrip } from "@/components/moderation/DriveQueueStrip"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { moderationRow } from "../../fixtures/workspace/moderation"

const meta = {
  title: "Features/Moderation/DriveQueueStrip",
  component: DriveQueueStrip,
  args: { rows: [{ drive: moderationRow.drive!, waiting: 4 }] },
} satisfies Meta<typeof DriveQueueStrip>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { rows: [] } }
