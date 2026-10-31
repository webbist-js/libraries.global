import { WidgetField } from "@/components/widgets/WidgetControls"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Widgets/WidgetField",
  component: WidgetField,
  args: {
    label: "Widget title",
    children: (
      <input
        aria-label="Widget title"
        defaultValue="Libraries in Northbridge"
      />
    ),
  },
} satisfies Meta<typeof WidgetField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
