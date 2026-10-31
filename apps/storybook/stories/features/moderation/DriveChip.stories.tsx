import { DriveChip } from "@/components/moderation/DriveChip"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { moderationRow } from "../../fixtures/workspace/moderation"

const meta = {
  title: "Features/Moderation/DriveChip",
  component: DriveChip,
  args: { drive: moderationRow.drive! },
} satisfies Meta<typeof DriveChip>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
