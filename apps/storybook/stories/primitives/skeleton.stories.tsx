import { Skeleton } from "@/components/ui/skeleton"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Primitives/skeleton",
  component: Skeleton,
  args: { className: "h-8 w-full" },
  render: (args) => (
    <div role="status" aria-label="Loading library record" aria-busy="true">
      <div aria-hidden="true" className="grid max-w-md gap-3">
        <Skeleton {...args} />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  ),
} satisfies Meta<typeof Skeleton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
