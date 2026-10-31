import { WidgetPublish } from "@/components/widgets/WidgetPublish"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import {
  widgetData,
  widgetWorkspace,
  widget,
} from "../../fixtures/workspace/widgets"

const meta = {
  title: "Features/Widgets/WidgetPublish",
  component: WidgetPublish,
  parameters: { docs: { story: { inline: false, height: "760px" } } },
  args: {
    workspace: widgetWorkspace,
    widget,
    resolved: widgetData,
    resolving: false,
    onAction: fn(async () => {}),
    busy: false,
    siteUrl: "https://example.invalid",
  },
} satisfies Meta<typeof WidgetPublish>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
