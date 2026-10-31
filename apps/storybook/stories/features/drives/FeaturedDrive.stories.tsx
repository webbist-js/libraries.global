import { FeaturedDrive } from "@/components/drives/FeaturedDrive"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { driveView, driveNow } from "../../fixtures/public/drives"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Drives/FeaturedDrive",
  component: FeaturedDrive,
  args: { view: driveView, howHref: "/knowledge/contributing", now: driveNow },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof FeaturedDrive>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
