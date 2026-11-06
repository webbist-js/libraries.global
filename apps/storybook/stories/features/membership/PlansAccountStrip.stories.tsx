import { PlansAccountStrip } from "@/components/membership/PlansAccountStrip"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Membership/PlansAccountStrip",
  component: PlansAccountStrip,
  args: {
    standing: "contributor",
    acceptedContributions: 12,
    recentlyActive: true,
  },
  parameters: { docs: { story: { inline: false, height: "900px" } } },
} satisfies Meta<typeof PlansAccountStrip>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Explorer: Story = {
  args: {
    standing: "explorer",
    acceptedContributions: 0,
    recentlyActive: false,
  },
}
export const Supporter: Story = {
  args: { standing: "supporter", acceptedContributions: 120 },
}
