import { Eyebrow } from "@/components/ds/Eyebrow"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Patterns/Eyebrow",
  component: Eyebrow,
  args: { children: "Explore the index", bar: true },
} satisfies Meta<typeof Eyebrow>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
