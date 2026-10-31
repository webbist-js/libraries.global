import { HomeStaffTools } from "@/components/home/HomeStaffTools"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { homepageContent } from "../../fixtures/public/homepage"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"
import { contributorSession } from "../../fixtures/public/session"

const meta = {
  title: "Features/Home/HomeStaffTools",
  component: HomeStaffTools,
  args: { tools: homepageContent.libraryTools },
  decorators: [
    (Story) => (
      <div data-homepage>
        <Story />
      </div>
    ),
  ],
  parameters: {
    fixtureSession: contributorSession,
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof HomeStaffTools>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
