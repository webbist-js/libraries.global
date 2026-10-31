import { StatBlock } from "@/components/ds/StatBlock"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Patterns/StatBlock",
  component: StatBlock,
  args: { value: "1,204", label: "Libraries indexed", size: "lg" },
} satisfies Meta<typeof StatBlock>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Small: Story = { args: { size: "sm", value: 0 } }
