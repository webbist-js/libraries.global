import { WidgetDraftStatus } from "@/components/widgets/WidgetDraftStatus"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { widgetState } from "../../fixtures/workspace/widgets"

const meta = {
  title: "Features/Widgets/WidgetDraftStatus",
  component: WidgetDraftStatus,
  args: { state: widgetState, active: true },
} satisfies Meta<typeof WidgetDraftStatus>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Saving: Story = {
  args: { state: { ...widgetState, phase: "saving" } },
}
export const Failed: Story = {
  args: {
    state: {
      ...widgetState,
      phase: "failed",
      error: "The draft could not be saved. Try again.",
    },
  },
}
export const Conflict: Story = {
  args: { state: { ...widgetState, phase: "conflict" } },
}
