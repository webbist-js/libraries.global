import { WidgetCreate } from "@/components/widgets/WidgetCreate"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  widgetResponses,
  widgetWorkspace,
} from "../../fixtures/workspace/widgets"

const meta = {
  title: "Features/Widgets/WidgetCreate",
  component: WidgetCreate,
  parameters: {
    fixtureResponses: widgetResponses,
    docs: { story: { inline: false } },
  },
  args: { data: widgetWorkspace },
} satisfies Meta<typeof WidgetCreate>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
