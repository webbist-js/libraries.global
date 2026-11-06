import { PlanCompareMobile } from "@/app/[locale]/(dashboard)/contribute/_components/membership/PlanCompareMobile"
import { useMembershipGroups } from "@/lib/localized-plans"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import type { ComponentProps } from "react"
import { fn } from "storybook/test"

type Props = ComponentProps<typeof PlanCompareMobile>

/** Localises the comparison groups the way the plans page does. */
function LocalizedMobile(props: Omit<Props, "groups">) {
  return <PlanCompareMobile {...props} groups={useMembershipGroups()} />
}

const meta = {
  title: "Features/Membership/PlanCompareMobile",
  component: LocalizedMobile,
  args: {
    open: new Set(["atlas"]),
    onToggle: fn(),
    selected: "contributor",
    baseline: "explorer",
  },
} satisfies Meta<typeof LocalizedMobile>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
