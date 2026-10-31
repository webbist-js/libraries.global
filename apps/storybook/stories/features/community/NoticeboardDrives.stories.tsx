import { NoticeboardDrives } from "@/app/[locale]/(dashboard)/community/_components/NoticeboardDrives"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  drive,
  driveView,
  closedDriveView,
  driveNow,
} from "../../fixtures/public/drives"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Community/Routes/NoticeboardDrives",
  component: NoticeboardDrives,
  args: {
    open: [driveView],
    finished: [closedDriveView],
    focus: null,
    howHref: "/knowledge/community-drives",
    followed: [drive.documentId],
    now: driveNow,
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
} satisfies Meta<typeof NoticeboardDrives>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { open: [], finished: [] } }
export const Filtered: Story = { args: { focus: "photo" } }
