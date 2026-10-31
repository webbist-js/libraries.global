import { PlanPill } from "@/components/global/ContributeMenuParts"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Global/PlanPill",
  component: PlanPill,
  args: { plan: "free" },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof PlanPill>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Pro: Story = { args: { plan: "pro" } }
export const Team: Story = { args: { plan: "team" } }
