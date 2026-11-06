import { SupporterMilestone } from "@/app/[locale]/(dashboard)/contribute/_components/membership/SupporterMilestone"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Membership/SupporterMilestone",
  component: SupporterMilestone,
} satisfies Meta<typeof SupporterMilestone>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
