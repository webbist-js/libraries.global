import { ClaimPanel } from "@/components/moderation/ClaimPanel"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Moderation/ClaimPanel",
  component: ClaimPanel,
  args: {
    fields: {
      name: "Northbridge Library",
      role: "librarian",
      relationship: "Library manager",
      statement: "I maintain the opening hours and visitor information.",
    },
    targetSlug: "northbridge",
  },
} satisfies Meta<typeof ClaimPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
