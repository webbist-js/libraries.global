import { DriveTaskPanel } from "@/components/drives/DriveTaskPanel"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import {
  drive,
  driveTasks,
  driveCorrectionWithHours,
} from "../../fixtures/public/drives"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Drives/DriveTaskPanel",
  component: DriveTaskPanel,
  args: {
    drive,
    task: driveTasks[0]!,
    signedIn: true,
    claimed: false,
    quota: { pendingCount: 1, pendingLimit: 5 },
    onSent: fn(),
    onSkip: fn(),
  },
  parameters: {
    docs: {
      story: { inline: false, iframeHeight: 900 },
      description: {
        component:
          "This example runs in its own iframe to keep fixture requests, caches and page landmarks independent. Open Canvas to use the interactive Controls.",
      },
    },
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof DriveTaskPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const SignedOut: Story = { args: { signedIn: false } }
export const QuotaFull: Story = {
  args: { quota: { pendingCount: 5, pendingLimit: 5 } },
}

export const ExistingHours: Story = {
  parameters: {
    fixtureResponses: {
      ...publicResponses,
      "GET /api/contribute/library/northbridge": {
        body: { data: driveCorrectionWithHours },
      },
    },
  },
}
