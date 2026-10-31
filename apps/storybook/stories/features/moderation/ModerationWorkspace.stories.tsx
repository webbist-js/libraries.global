import { ModerationWorkspace } from "@/components/moderation/ModerationWorkspace"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { views } from "../../fixtures/workspace/moderation"

const meta = {
  title: "Features/Moderation/ModerationWorkspace",
  component: ModerationWorkspace,
  args: { views, children: <p>Select a queue to review contributions.</p> },
} satisfies Meta<typeof ModerationWorkspace>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
