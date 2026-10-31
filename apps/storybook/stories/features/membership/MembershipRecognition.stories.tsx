import { MembershipRecognition } from "@/app/[locale]/(dashboard)/contribute/_components/membership/PlanStatusBanner"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Membership/MembershipRecognition",
  component: MembershipRecognition,
  args: {},
} satisfies Meta<typeof MembershipRecognition>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
