import { AdornmentSuccess } from "@/components/forms/Adornment"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Forms/AdornmentSuccess",
  component: AdornmentSuccess,
  args: {},
  render: () => (
    <span role="img" aria-label="Valid value">
      <AdornmentSuccess />
    </span>
  ),
} satisfies Meta<typeof AdornmentSuccess>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
