import { DriveTitle } from "@/components/drives/DriveTitle"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { drive } from "../../fixtures/public/drives"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Drives/DriveTitle",
  component: DriveTitle,
  args: { title: drive.title },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof DriveTitle>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
