import { CountPill } from "@/components/global/ContributeMenuParts"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Global/CountPill",
  component: CountPill,
  args: { count: 14, what: "suggestions waiting" },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof CountPill>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Zero: Story = { args: { count: 0 } }
export const LargeCount: Story = { args: { count: 1240 } }
