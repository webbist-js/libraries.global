import { RunningCosts } from "@/app/[locale]/(dashboard)/community/supporters/_components/RunningCosts"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Community/Routes/RunningCosts",
  component: RunningCosts,
  args: {
    costs: {
      month: "2026-01-01",
      currency: "GBP",
      runningCosts: 180,
      supportIncome: 135,
      breakdown: "Hosting, database and transactional email.",
    },
    locale: "en",
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof RunningCosts>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const CostsOnly: Story = {
  args: {
    costs: {
      month: "2026-01-01",
      currency: "GBP",
      runningCosts: 180,
      supportIncome: null,
      breakdown: null,
    },
  },
}
