import { Spinner } from "@/components/elementary/Spinner"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Primitives/Spinner",
  component: Spinner,
  args: {
    className: "size-8",
    borderColorClass: "border-(--t-accent-primary)",
    borderWidthClass: "border-2",
  },
  decorators: [
    (Story) => (
      <div role="status" aria-label="Loading">
        <span aria-hidden="true">
          <Story />
        </span>
      </div>
    ),
  ],
} satisfies Meta<typeof Spinner>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
