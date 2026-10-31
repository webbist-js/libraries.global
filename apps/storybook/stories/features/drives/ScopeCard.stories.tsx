import { ScopeCard } from "@/components/drives/DriveBuilderRail"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Drives/ScopeCard",
  component: ScopeCard,
  args: {
    counts: {
      status: "ready",
      total: 50,
      todo: 18,
      places: [
        {
          level: "region",
          slug: "northbridge",
          name: "Northbridge",
          total: 50,
          todo: 18,
        },
      ],
    },
    focusKind: "gaps",
    locked: false,
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof ScopeCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Loading: Story = { args: { counts: { status: "loading" } } }
export const Unavailable: Story = { args: { counts: { status: "error" } } }
