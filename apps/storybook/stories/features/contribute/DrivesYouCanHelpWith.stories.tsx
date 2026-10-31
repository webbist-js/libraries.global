import { DrivesYouCanHelpWith } from "@/app/[locale]/(dashboard)/contribute/_components/hub/DrivesYouCanHelpWith"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { driveView } from "../../fixtures/public/drives"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Contribute/Routes/DrivesYouCanHelpWith",
  component: DrivesYouCanHelpWith,
  args: { views: [driveView] },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof DrivesYouCanHelpWith>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
