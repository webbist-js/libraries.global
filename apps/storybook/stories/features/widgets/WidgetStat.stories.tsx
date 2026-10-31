import { WidgetStat } from "@/components/widgets/WidgetStat"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { widgetData } from "../../fixtures/workspace/widgets"

const meta = {
  title: "Features/Widgets/WidgetStat",
  component: WidgetStat,
  args: { data: { ...widgetData, type: "stat" } },
} satisfies Meta<typeof WidgetStat>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
