import { PlanCompareMobile } from "@/app/[locale]/(dashboard)/contribute/_components/membership/PlanCompareMobile"
import { compareGroups } from "@/lib/plan-compare"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

const meta = {
  title: "Features/Membership/PlanCompareMobile",
  component: PlanCompareMobile,
  args: {
    groups: compareGroups(),
    open: new Set([compareGroups()[0]!.id]),
    onToggle: fn(),
    selected: "pro",
    baseline: "free",
  },
} satisfies Meta<typeof PlanCompareMobile>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
