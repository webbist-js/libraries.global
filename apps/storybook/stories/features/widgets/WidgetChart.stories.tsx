import { WidgetChart } from "@/components/widgets/WidgetChart"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { widgetData } from "../../fixtures/workspace/widgets"

const meta = {
  title: "Features/Widgets/WidgetChart",
  component: WidgetChart,
  args: { data: { ...widgetData, type: "chart" } },
} satisfies Meta<typeof WidgetChart>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
