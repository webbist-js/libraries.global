import { NoDrivesCard } from "@/app/[locale]/(dashboard)/community/_components/NoDrivesCard"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Community/Routes/NoDrivesCard",
  component: NoDrivesCard,
  args: { hasGaps: true },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof NoDrivesCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const NoKnownGaps: Story = { args: { hasGaps: false } }
