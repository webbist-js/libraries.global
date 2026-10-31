import { ModerationOverview } from "@/components/moderation/ModerationOverview"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { views } from "../../fixtures/workspace/moderation"

const meta = {
  title: "Features/Moderation/ModerationOverview",
  component: ModerationOverview,
  args: { views },
} satisfies Meta<typeof ModerationOverview>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
