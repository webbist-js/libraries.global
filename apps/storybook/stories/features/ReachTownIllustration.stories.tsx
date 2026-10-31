import { ReachTownIllustration } from "@/components/home/ReachTownIllustration"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Home/ReachTownIllustration",
  component: ReachTownIllustration,
  args: {},
} satisfies Meta<typeof ReachTownIllustration>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
