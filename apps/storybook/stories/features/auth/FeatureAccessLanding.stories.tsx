import { FeatureAccessLanding } from "@/components/auth/FeatureAccessLanding"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { asyncStory } from "../../../.storybook/AsyncStory"

const meta = {
  title: "Features/Auth/Feature access",
  component: FeatureAccessLanding,
  render: asyncStory(FeatureAccessLanding),
  args: { feature: "index", signedIn: false, returnTo: "/contribute/index" },
  parameters: {
    react: { rsc: true },
    layout: "fullscreen",
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof FeatureAccessLanding>

export default meta
type Story = StoryObj<typeof meta>

export const SignInRequired: Story = {}
export const TeamMembershipRequired: Story = {
  args: {
    feature: "widgets",
    signedIn: true,
    returnTo: "/staff/teams/widgets",
  },
}
export const ApiMembershipRequired: Story = {
  args: { feature: "api", signedIn: true, returnTo: "/staff/teams/api" },
}
