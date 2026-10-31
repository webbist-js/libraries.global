import { FindErrorState } from "@/components/index-page/FindStates"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

const meta = {
  title: "Features/Library search/FindErrorState",
  component: FindErrorState,
  args: { onRetry: fn() },
} satisfies Meta<typeof FindErrorState>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
