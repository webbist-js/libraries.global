import { AdornmentError } from "@/components/forms/Adornment"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Forms/AdornmentError",
  component: AdornmentError,
  args: {},
  render: () => (
    <span role="img" aria-label="Value needs attention">
      <AdornmentError />
    </span>
  ),
} satisfies Meta<typeof AdornmentError>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
