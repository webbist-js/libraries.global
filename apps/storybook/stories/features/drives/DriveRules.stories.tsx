import { DriveRules } from "@/components/drives/DriveRules"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { drive } from "../../fixtures/public/drives"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Drives/DriveRules",
  component: DriveRules,
  args: { drive, source: "Published library websites", total: 50 },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof DriveRules>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
