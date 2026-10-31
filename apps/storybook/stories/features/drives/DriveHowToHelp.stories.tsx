import { DriveHowToHelp } from "@/components/drives/DriveHowToHelp"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import { drive } from "../../fixtures/public/drives"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Drives/DriveHowToHelp",
  component: DriveHowToHelp,
  args: { drive, onRandom: fn() },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof DriveHowToHelp>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Busy: Story = { args: { busy: true } }
export const Disabled: Story = { args: { disabled: true } }
