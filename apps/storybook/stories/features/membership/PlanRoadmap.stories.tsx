import { PlanRoadmap } from "@/app/[locale]/(dashboard)/contribute/_components/membership/PlanRoadmap"
import { PLANS } from "@/lib/plans"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Membership/PlanRoadmap",
  component: PlanRoadmap,
  args: { plan: PLANS.find((p) => p.key === "pro")! },
} satisfies Meta<typeof PlanRoadmap>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
