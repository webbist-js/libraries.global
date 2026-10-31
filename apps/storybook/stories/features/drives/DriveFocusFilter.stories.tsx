import { DriveFocusFilter } from "@/components/drives/DriveFocusFilter"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Drives/DriveFocusFilter",
  component: DriveFocusFilter,
  args: {
    options: [
      {
        key: "hours",
        label: "Opening hours",
        icon: "mdi:clock-outline",
        count: 3,
      },
      {
        key: "photo",
        label: "Photographs",
        icon: "mdi:camera-outline",
        count: 2,
      },
    ],
    total: 5,
    active: "hours",
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof DriveFocusFilter>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
