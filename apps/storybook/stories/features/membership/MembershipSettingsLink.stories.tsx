import { MembershipSettingsLink } from "@/components/membership/MembershipSettingsLink"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Membership/MembershipSettingsLink",
  component: MembershipSettingsLink,
  args: { plan: "pro", source: "paid" },
  parameters: { docs: { story: { inline: false, height: "900px" } } },
} satisfies Meta<typeof MembershipSettingsLink>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const TeamSeat: Story = { args: { plan: "team", source: "team" } }
