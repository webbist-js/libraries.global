import { ContributionHeatmap } from "@/app/[locale]/profile/[username]/_components/ContributionHeatmap"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  profileResponses,
  readerSession,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Profile/ContributionHeatmap",
  component: ContributionHeatmap,
  args: { submissions: [], now: Date.parse("2026-01-15T12:00:00Z") },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false, height: "800px" } },
  },
} satisfies Meta<typeof ContributionHeatmap>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
