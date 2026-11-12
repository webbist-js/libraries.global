import { RenounceLibraryClaim } from "@/components/staff/RenounceLibraryClaim"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Staff/RenounceLibraryClaim",
  component: RenounceLibraryClaim,
  args: {
    libraryId: "example-library",
    libraryName: "Northbridge Community Library",
  },
  decorators: [
    (Story) => (
      <div className="max-w-lg">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RenounceLibraryClaim>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
