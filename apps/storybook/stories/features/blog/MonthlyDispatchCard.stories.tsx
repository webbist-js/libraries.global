import { MonthlyDispatchCard } from "@/components/blog/MonthlyDispatchCard"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Blog/MonthlyDispatchCard",
  component: MonthlyDispatchCard,
  args: {},
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof MonthlyDispatchCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
