import { FindEmptyState } from "@/components/index-page/FindStates"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

const meta = {
  title: "Features/Library search/FindEmptyState",
  component: FindEmptyState,
  args: { onClear: fn() },
} satisfies Meta<typeof FindEmptyState>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
