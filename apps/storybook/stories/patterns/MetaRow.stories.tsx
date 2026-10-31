import { MetaRow } from "@/components/ds/MetaRow"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Patterns/MetaRow",
  component: MetaRow,
  args: {
    items: ["Public library", null, "Northbridge", "Updated 15 January"],
    separator: "·",
  },
} satisfies Meta<typeof MetaRow>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { items: [] } }
