import { FinishedDrives } from "@/components/drives/FinishedDrives"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { closedDriveView } from "../../fixtures/public/drives"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Drives/FinishedDrives",
  component: FinishedDrives,
  args: { views: [closedDriveView] },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof FinishedDrives>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { views: [] } }
