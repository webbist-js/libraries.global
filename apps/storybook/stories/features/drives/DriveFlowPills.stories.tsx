import { DriveFlowPills } from "@/components/drives/DriveFlowPills"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Drives/DriveFlowPills",
  component: DriveFlowPills,
  args: {
    steps: ["Choose a library", "Add a public source", "Submit for review"],
    label: "How to contribute",
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof DriveFlowPills>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
