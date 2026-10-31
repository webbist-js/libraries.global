import { DriveProgressSummary } from "@/components/drives/DriveProgressSummary"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { drive, driveView } from "../../fixtures/public/drives"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Drives/DriveProgressSummary",
  component: DriveProgressSummary,
  args: {
    progress: driveView.progress!,
    unit: "library",
    gapPhrase: "with opening hours",
    goalPercent: 80,
    helpers: 12,
    log: drive.progressLog,
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof DriveProgressSummary>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
