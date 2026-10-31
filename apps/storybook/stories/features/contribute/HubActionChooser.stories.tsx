import { HubActionChooser } from "@/app/[locale]/(dashboard)/contribute/_components/hub/HubActionChooser"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"
import { contributorSession } from "../../fixtures/public/session"

const meta = {
  title: "Features/Contribute/Routes/HubActionChooser",
  component: HubActionChooser,
  args: {
    publishedCount: 1200,
    suggestions: [
      {
        slug: "northbridge-library",
        name: "Northbridge Library",
        place: "Northbridge",
        missing: ["Opening hours"],
      },
    ],
  },
  parameters: {
    fixtureSession: contributorSession,
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof HubActionChooser>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
