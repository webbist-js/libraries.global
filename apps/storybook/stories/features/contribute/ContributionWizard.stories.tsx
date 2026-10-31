import { ContributionWizard } from "@/components/contribute/ContributionWizard"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"
import { contributorSession } from "../../fixtures/public/session"

const meta = {
  title: "Features/Contribute/ContributionWizard",
  component: ContributionWizard,
  args: { action: "correction", returnTo: "/contribute", publishedCount: 1200 },
  parameters: {
    fixtureSession: contributorSession,
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof ContributionWizard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const SharePhoto: Story = { args: { action: "photo" } }
export const AddSource: Story = { args: { action: "source" } }
export const JournalHandoff: Story = { args: { action: "journal" } }
