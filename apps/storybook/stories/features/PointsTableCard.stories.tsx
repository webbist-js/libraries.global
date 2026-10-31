import { PointsTableCard } from "@/components/community/PointsTableCard"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Community/PointsTableCard",
  component: PointsTableCard,
  args: {},
} satisfies Meta<typeof PointsTableCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
