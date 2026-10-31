import { MembershipPlans } from "@/app/[locale]/(dashboard)/contribute/_components/membership/MembershipPlans"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Membership/MembershipPlans",
  component: MembershipPlans,
  args: {
    currentPlan: "free",
    teams: [],
    billingAvailable: true,
    checkoutUser: {
      email: "member@example.invalid",
      verified: true,
      complimentaryPro: false,
    },
  },
} satisfies Meta<typeof MembershipPlans>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Pro: Story = { args: { currentPlan: "pro" } }
export const SignedOut: Story = { args: { checkoutUser: null } }
