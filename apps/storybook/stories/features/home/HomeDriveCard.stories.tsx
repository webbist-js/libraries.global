import { HomeDriveCard } from "@/components/home/sections/HomeDriveCard"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { homepageDrives } from "../../fixtures/public/homepage"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Home/HomeDriveCard",
  component: HomeDriveCard,
  args: { view: homepageDrives[0]!, index: 0 },
  decorators: [
    (Story) => (
      <div data-homepage>
        <Story />
      </div>
    ),
  ],
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof HomeDriveCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
