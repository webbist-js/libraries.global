import { DriveCard } from "@/components/drives/DriveCard"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  driveView,
  closedDriveView,
  driveNow,
} from "../../fixtures/public/drives"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Drives/DriveCard",
  component: DriveCard,
  args: { view: driveView, now: driveNow, showHelpers: true },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof DriveCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Finished: Story = { args: { view: closedDriveView } }
