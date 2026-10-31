import { WidgetError } from "@/components/widgets/WidgetControls"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Widgets/WidgetError",
  component: WidgetError,
  args: { error: "The library data could not be loaded. Try again." },
} satisfies Meta<typeof WidgetError>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
