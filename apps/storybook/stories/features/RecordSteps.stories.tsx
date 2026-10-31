import { RecordSteps } from "@/components/about/AboutChapterControls"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/About/RecordSteps",
  component: RecordSteps,
  args: {},
} satisfies Meta<typeof RecordSteps>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
