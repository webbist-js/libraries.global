import { Typography } from "@/components/typography"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Foundations/Typography/Text roles",
  component: Typography,
  args: { children: "A library for everyone", variant: "heading2", tag: "h2" },
} satisfies Meta<typeof Typography>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Body: Story = {
  args: {
    children: "Find books, reading rooms and activities at your local library.",
    variant: "medium",
    tag: "p",
  },
}
