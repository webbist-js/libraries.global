import { WidgetEditor } from "@/components/widgets/WidgetEditor"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  widgetResponses,
  widgetWorkspace,
  widget,
} from "../../fixtures/workspace/widgets"

const meta = {
  title: "Features/Widgets/WidgetEditor",
  component: WidgetEditor,
  parameters: {
    fixtureResponses: widgetResponses,
    docs: { story: { inline: false } },
  },
  args: {
    workspace: widgetWorkspace,
    initial: widget,
    siteUrl: "https://example.invalid",
  },
} satisfies Meta<typeof WidgetEditor>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
