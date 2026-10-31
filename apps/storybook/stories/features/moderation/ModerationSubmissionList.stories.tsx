import { ModerationSubmissionList } from "@/components/moderation/ModerationSubmissionList"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { moderationRow } from "../../fixtures/workspace/moderation"

const meta = {
  title: "Features/Moderation/ModerationSubmissionList",
  component: ModerationSubmissionList,
  args: {
    rows: [moderationRow],
    localeNames: { en: "English", fr: "French", cs: "Czech" },
  },
} satisfies Meta<typeof ModerationSubmissionList>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { rows: [] } }
