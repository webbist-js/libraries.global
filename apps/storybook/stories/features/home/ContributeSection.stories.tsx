import { ContributeSection } from "@/components/home/sections/ContributeSection"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  homepageContent,
  homepageTasks,
  homepageDrives,
} from "../../fixtures/public/homepage"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Home/ContributeSection",
  component: ContributeSection,
  args: {
    band: homepageContent.communityBand,
    steps: homepageContent.communitySteps,
    tasksIntro: homepageContent.tasksIntro,
    tasks: homepageTasks,
    drives: homepageDrives,
  },
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
} satisfies Meta<typeof ContributeSection>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
