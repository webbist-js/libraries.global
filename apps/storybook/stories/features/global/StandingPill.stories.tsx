import { StandingPill } from "@/components/global/ContributeMenuParts"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Global/StandingPill",
  component: StandingPill,
  args: { standing: "explorer" },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof StandingPill>

export default meta
type Story = StoryObj<typeof meta>

export const Explorer: Story = {}
export const Contributor: Story = { args: { standing: "contributor" } }
export const Supporter: Story = { args: { standing: "supporter" } }
