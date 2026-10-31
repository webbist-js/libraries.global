import { AuthorBadges } from "@/components/discussions/AuthorBadges"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Discussions/AuthorBadges",
  component: AuthorBadges,
  args: {
    badges: ["editorial_board", "editor", "moderator", "suggested_this"],
  },
} satisfies Meta<typeof AuthorBadges>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
