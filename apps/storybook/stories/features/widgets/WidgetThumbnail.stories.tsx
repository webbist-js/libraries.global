import { WidgetThumbnail } from "@/components/widgets/WidgetThumbnail"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Widgets/WidgetThumbnail",
  component: WidgetThumbnail,
  args: { type: "finder" },
} satisfies Meta<typeof WidgetThumbnail>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Chart: Story = { args: { type: "chart" } }
export const Directory: Story = { args: { type: "directory" } }
export const Stat: Story = { args: { type: "stat" } }
