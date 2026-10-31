import { DriveDates } from "@/components/drives/DriveDates"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { drive, closedDriveView, driveNow } from "../../fixtures/public/drives"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Drives/DriveDates",
  component: DriveDates,
  args: { drive, now: driveNow, detail: true },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof DriveDates>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Finished: Story = { args: { drive: closedDriveView.drive } }
