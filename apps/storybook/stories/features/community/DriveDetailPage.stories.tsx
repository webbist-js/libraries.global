import { DriveDetailPage } from "@/app/[locale]/(dashboard)/community/_components/DriveDetailPage"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  drive,
  driveView,
  closedDriveView,
  driveHelpers,
} from "../../fixtures/public/drives"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Community/Routes/DriveDetailPage",
  component: DriveDetailPage,
  args: {
    drive,
    view: driveView,
    week: driveHelpers,
    all: driveHelpers,
    counts: { noticeboard: 2, suggestions: 3 },
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
} satisfies Meta<typeof DriveDetailPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Finished: Story = {
  args: { drive: closedDriveView.drive, view: closedDriveView },
}
