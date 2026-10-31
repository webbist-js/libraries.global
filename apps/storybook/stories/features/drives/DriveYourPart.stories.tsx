import { DriveYourPart } from "@/components/drives/DriveYourPart"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Drives/DriveYourPart",
  component: DriveYourPart,
  args: {
    mine: { sent: 6, inReview: 2, accepted: 4 },
    quota: { pendingCount: 2, pendingLimit: 5 },
    toArchivist: 8,
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof DriveYourPart>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const NoContributions: Story = {
  args: { mine: null, quota: null, toArchivist: null },
}
