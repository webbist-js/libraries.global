import { MembershipPolicies } from "@/app/[locale]/(dashboard)/contribute/_components/membership/MembershipPolicies"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { asyncStory } from "../../../.storybook/AsyncStory"

const meta = {
  title: "Features/Membership/MembershipPolicies",
  component: MembershipPolicies,
  render: asyncStory(MembershipPolicies),
  parameters: { react: { rsc: true }, docs: { story: { inline: false } } },
  args: {},
} satisfies Meta<Record<string, never>>

export default meta
type Story = StoryObj<Record<string, never>>

export const Default: Story = {}
