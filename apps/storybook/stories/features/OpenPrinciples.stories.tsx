import { OpenPrinciples } from "@/components/about/AboutChapterControls"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/About/OpenPrinciples",
  component: OpenPrinciples,
  args: {},
} satisfies Meta<typeof OpenPrinciples>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
