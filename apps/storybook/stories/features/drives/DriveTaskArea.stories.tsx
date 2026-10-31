import { DriveTaskArea } from "@/components/drives/DriveTaskArea"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { drive } from "../../fixtures/public/drives"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Drives/DriveTaskArea",
  component: DriveTaskArea,
  args: { drive },
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
} satisfies Meta<typeof DriveTaskArea>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
