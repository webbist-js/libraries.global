import { FindSkeletonGrid } from "@/components/index-page/FindStates"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Library search/FindSkeletonGrid",
  component: FindSkeletonGrid,
  args: {},
} satisfies Meta<typeof FindSkeletonGrid>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
