import { DiscussionTime } from "@/components/discussions/DiscussionPresentation"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Discussions/DiscussionTime",
  component: DiscussionTime,
  args: { value: "2026-01-15T10:00:00Z", compact: false },
  parameters: { docs: { story: { inline: false, height: "900px" } } },
} satisfies Meta<typeof DiscussionTime>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Compact: Story = { args: { compact: true } }
