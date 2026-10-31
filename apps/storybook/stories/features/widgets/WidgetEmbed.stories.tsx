import { WidgetEmbed } from "@/components/widgets/WidgetPublish"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { widget } from "../../fixtures/workspace/widgets"

const meta = {
  title: "Features/Widgets/WidgetEmbed",
  component: WidgetEmbed,
  parameters: { docs: { story: { inline: false, height: "760px" } } },
  args: { widget, siteUrl: "https://example.invalid" },
} satisfies Meta<typeof WidgetEmbed>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
