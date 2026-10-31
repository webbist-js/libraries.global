import { DriveProgress } from "@/components/drives/DriveProgress"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { drive, driveView } from "../../fixtures/public/drives"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Drives/DriveProgress",
  component: DriveProgress,
  args: {
    progress: driveView.progress!,
    unit: "library",
    gapPhrase: "with opening hours",
    log: drive.progressLog,
    goalPercent: 80,
    meta: "12 people helping",
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof DriveProgress>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
