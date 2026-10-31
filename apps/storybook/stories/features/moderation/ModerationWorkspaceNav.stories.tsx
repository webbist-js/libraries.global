import { ModerationWorkspaceNav } from "@/components/moderation/ModerationWorkspaceNav"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { views } from "../../fixtures/workspace/moderation"

const meta = {
  title: "Features/Moderation/ModerationWorkspaceNav",
  component: ModerationWorkspaceNav,
  args: { active: "overview", views },
} satisfies Meta<typeof ModerationWorkspaceNav>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
