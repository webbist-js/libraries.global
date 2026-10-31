import { ModerationNavigationLinks } from "@/components/moderation/ModerationWorkspaceNav"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { views } from "../../fixtures/workspace/moderation"

const meta = {
  title: "Features/Moderation/ModerationNavigationLinks",
  component: ModerationNavigationLinks,
  args: { active: "libraries", views, sidebar: true },
} satisfies Meta<typeof ModerationNavigationLinks>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
