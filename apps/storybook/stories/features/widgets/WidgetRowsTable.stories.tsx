import { WidgetRowsTable } from "@/components/widgets/WidgetRowsTable"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { widgetData } from "../../fixtures/workspace/widgets"

const meta = {
  title: "Features/Widgets/WidgetRowsTable",
  component: WidgetRowsTable,
  args: { rows: widgetData.rows },
} satisfies Meta<typeof WidgetRowsTable>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { rows: [] } }
