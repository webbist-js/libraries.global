import { WidgetManage } from "@/components/widgets/WidgetManage"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import { widgetWorkspace, widget } from "../../fixtures/workspace/widgets"

const meta = {
  title: "Features/Widgets/WidgetManage",
  component: WidgetManage,
  parameters: { docs: { story: { inline: false, height: "760px" } } },
  args: {
    workspace: widgetWorkspace,
    widget,
    onAction: fn(async () => {}),
    busy: false,
    siteUrl: "https://example.invalid",
  },
} satisfies Meta<typeof WidgetManage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
