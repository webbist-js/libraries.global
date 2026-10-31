import { Badge } from "@/components/ds/Badge"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Patterns/Badge",
  component: Badge,
  args: { label: "Public library", color: "ok", dot: false, size: "sm" },
  argTypes: {
    color: {
      control: "select",
      options: [
        "aurora",
        "violet",
        "ember",
        "gold",
        "ok",
        "warn",
        "danger",
        "dim",
      ],
    },
    size: { control: "inline-radio", options: ["xs", "sm", "md"] },
  },
} satisfies Meta<typeof Badge>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const WithDot: Story = { args: { dot: true } }
export const Warning: Story = { args: { label: "Needs review", color: "warn" } }
export const WithIcon: Story = { args: { icon: "mdi:library-outline" } }
export const LongLabel: Story = {
  args: { label: "Community managed mobile library service" },
}
