import { WidgetFinder } from "@/components/widgets/WidgetFinder"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { widgetData } from "../../fixtures/workspace/widgets"

const meta = {
  title: "Features/Widgets/WidgetFinder",
  component: WidgetFinder,
  args: { data: widgetData, siteUrl: "https://example.invalid" },
} satisfies Meta<typeof WidgetFinder>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { data: { ...widgetData, rows: [] } } }
