import { ContributionAccountGuard } from "@/components/contribute/ContributionAccountGuard"
import { contributionAccountScope } from "@/lib/contribution-account-scope"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"
import { contributorSession } from "../../fixtures/public/session"

const meta = {
  title: "Features/Contribute/ContributionAccountGuard",
  component: ContributionAccountGuard,
  args: {
    expectedScope: contributionAccountScope(contributorSession.user),
    children: <p>Your draft is ready to edit.</p>,
  },
  parameters: {
    fixtureSession: contributorSession,
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof ContributionAccountGuard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const AccountChanged: Story = { args: { expectedScope: "guest" } }
