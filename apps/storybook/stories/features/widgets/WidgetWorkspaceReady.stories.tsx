import { WidgetWorkspaceReady } from "@/components/widgets/WidgetWorkspaceReady"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Widgets/WidgetWorkspaceReady",
  component: WidgetWorkspaceReady,
  args: { children: <p>The widget workspace is ready.</p> },
} satisfies Meta<typeof WidgetWorkspaceReady>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
