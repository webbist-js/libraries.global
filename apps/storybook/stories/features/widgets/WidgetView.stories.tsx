import { WidgetView } from "@/components/widgets/WidgetView"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { widgetData } from "../../fixtures/workspace/widgets"

const meta = {
  title: "Features/Widgets/WidgetView",
  component: WidgetView,
  args: { data: widgetData, siteUrl: "https://example.invalid", preview: true },
} satisfies Meta<typeof WidgetView>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Chart: Story = { args: { data: { ...widgetData, type: "chart" } } }
export const Statistic: Story = {
  args: { data: { ...widgetData, type: "stat" } },
}
export const Empty: Story = { args: { data: { ...widgetData, rows: [] } } }
