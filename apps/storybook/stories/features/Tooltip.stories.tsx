import { Tooltip } from "@/components/elementary/Tooltip"
import { Button } from "@/components/ui/button"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Patterns/Legacy tooltip",
  component: Tooltip,
  args: {
    content: "This library’s opening hours were recently verified.",
    children: <Button variant="surface">Verification details</Button>,
  },
} satisfies Meta<typeof Tooltip>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
