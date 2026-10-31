import { StandingCard } from "@/components/community/StandingCard"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { standing } from "../../fixtures/public/community"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Community/StandingCard",
  component: StandingCard,
  args: {
    standing,
    signedIn: true,
    initials: "MS",
    signInReturnTo: "/community",
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof StandingCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const SignedOut: Story = { args: { standing: null, signedIn: false } }
export const Compact: Story = { args: { compact: true } }
