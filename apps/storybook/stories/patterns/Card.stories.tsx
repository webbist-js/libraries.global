import { Card } from "@/components/ds/Card"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Patterns/Card",
  component: Card,
  args: {
    children: "A reusable surface for related content.",
    className: "p-6",
    as: "article",
  },
} satisfies Meta<typeof Card>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Hover: Story = { args: { hover: true } }
