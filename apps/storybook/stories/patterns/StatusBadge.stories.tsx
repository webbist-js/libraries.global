import { StatusBadge } from "@/components/ds/StatusBadge"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Patterns/StatusBadge",
  component: StatusBadge,
  args: { children: "Published", tone: "ok", pulse: false },
  argTypes: {
    tone: {
      control: "select",
      options: ["ok", "info", "warn", "danger", "neutral"],
    },
  },
} satisfies Meta<typeof StatusBadge>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Pending: Story = {
  args: { children: "Awaiting review", tone: "neutral" },
}
export const Danger: Story = {
  args: { children: "Feed unavailable", tone: "danger" },
}
