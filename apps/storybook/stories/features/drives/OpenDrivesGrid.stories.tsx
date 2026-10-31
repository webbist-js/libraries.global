import { OpenDrivesGrid } from "@/components/drives/OpenDrivesGrid"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { drive, driveView, driveNow } from "../../fixtures/public/drives"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Drives/OpenDrivesGrid",
  component: OpenDrivesGrid,
  args: { views: [driveView], followed: [drive.documentId], now: driveNow },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof OpenDrivesGrid>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { views: [] } }
