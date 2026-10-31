import { ContributionNetwork } from "@/components/about/AboutChapterControls"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/About/ContributionNetwork",
  component: ContributionNetwork,
  args: {},
} satisfies Meta<typeof ContributionNetwork>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
