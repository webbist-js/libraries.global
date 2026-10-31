import { DriveHelpers } from "@/components/drives/DriveHelpers"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { driveHelpers } from "../../fixtures/public/drives"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Drives/DriveHelpers",
  component: DriveHelpers,
  args: { week: driveHelpers, all: driveHelpers, publicOnly: true },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof DriveHelpers>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { week: [], all: [] } }
