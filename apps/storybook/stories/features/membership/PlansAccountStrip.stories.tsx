import { PlansAccountStrip } from "@/components/membership/PlansAccountStrip"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Membership/PlansAccountStrip",
  component: PlansAccountStrip,
  args: { plan: "pro", source: "paid" },
  parameters: { docs: { story: { inline: false, height: "900px" } } },
} satisfies Meta<typeof PlansAccountStrip>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Free: Story = { args: { plan: "free", source: "none" } }
export const TeamSeat: Story = { args: { plan: "team", source: "team" } }
