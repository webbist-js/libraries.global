import { DrivesHere } from "@/components/drives/DrivesHere"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { driveView } from "../../fixtures/public/drives"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Drives/DrivesHere",
  component: DrivesHere,
  args: { placeName: "Northbridge", items: [{ view: driveView, here: 12 }] },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof DrivesHere>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { items: [] } }
