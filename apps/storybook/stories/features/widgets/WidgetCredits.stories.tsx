import { WidgetCredits } from "@/components/widgets/WidgetCredits"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { widgetData } from "../../fixtures/workspace/widgets"

const meta = {
  title: "Features/Widgets/WidgetCredits",
  component: WidgetCredits,
  args: { data: widgetData, siteUrl: "https://example.invalid" },
} satisfies Meta<typeof WidgetCredits>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
