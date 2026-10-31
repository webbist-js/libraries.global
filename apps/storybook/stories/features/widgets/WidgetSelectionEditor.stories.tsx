import { WidgetSelectionEditor } from "@/components/widgets/WidgetSelectionEditor"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  widgetResponses,
  widgetWorkspace,
  selection,
} from "../../fixtures/workspace/widgets"

const meta = {
  title: "Features/Widgets/WidgetSelectionEditor",
  component: WidgetSelectionEditor,
  parameters: {
    fixtureResponses: widgetResponses,
    docs: { story: { inline: false } },
  },
  args: { workspace: widgetWorkspace, initial: selection },
} satisfies Meta<typeof WidgetSelectionEditor>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
