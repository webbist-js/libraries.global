import { DriveBuilder } from "@/components/drives/DriveBuilder"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Drives/DriveBuilder",
  component: DriveBuilder,
  args: {
    locale: "en",
    mode: "propose",
    restoreDraft: false,
    standing: { accepted: 24, open: null },
    userId: "example-person",
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof DriveBuilder>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Blocked: Story = {
  args: { blocked: "Finish your profile before proposing a drive." },
}
