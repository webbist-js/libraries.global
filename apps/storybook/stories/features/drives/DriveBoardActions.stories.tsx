import { DriveBoardActions } from "@/components/drives/DriveBoardActions"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { drive } from "../../fixtures/public/drives"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Drives/DriveBoardActions",
  component: DriveBoardActions,
  args: { drive },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof DriveBoardActions>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
