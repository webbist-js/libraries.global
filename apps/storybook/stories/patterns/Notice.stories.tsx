import { Notice } from "@/components/ds/Notice"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Patterns/Notice",
  component: Notice,
  args: {
    tone: "info",
    title: "Library access needs review",
    icon: "mdi:information-outline",
    children: "A moderator checks library claims before staff access opens.",
  },
} satisfies Meta<typeof Notice>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Success: Story = {
  args: {
    tone: "ok",
    title: "Changes published",
    icon: "mdi:check-circle-outline",
    children: "Your approved record changes are visible to visitors.",
  },
}
export const Warning: Story = {
  args: {
    tone: "warn",
    title: "Check the source",
    icon: "mdi:alert-outline",
    children: "Confirm the source details before sending this request.",
  },
}
