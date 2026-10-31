import { WidgetChartBar } from "@/components/widgets/WidgetChartBar"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { widgetData } from "../../fixtures/workspace/widgets"

const meta = {
  title: "Features/Widgets/WidgetChartBar",
  component: WidgetChartBar,
  args: {
    m: {
      id: "stepfree",
      name: "Step-free access",
      total: 10,
      yes: 7,
      no: 2,
      unknown: 1,
      recorded: 9,
      percentage: 70,
    },
    metric: [
      {
        id: "stepfree",
        name: "Step-free access",
        total: 10,
        yes: 7,
        no: 2,
        unknown: 1,
        recorded: 9,
        percentage: 70,
      },
    ],
    c: widgetData.config,
    accent: "#4338ca",
  },
} satisfies Meta<typeof WidgetChartBar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
