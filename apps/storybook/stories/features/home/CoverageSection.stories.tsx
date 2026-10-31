import { CoverageSection } from "@/components/home/sections/CoverageSection"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { homepageContinents } from "../../fixtures/public/homepage"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Home/CoverageSection",
  component: CoverageSection,
  args: {
    intro: {
      title: "Libraries around the world",
      text: "Explore the public records shared by the library community.",
    },
    continents: homepageContinents,
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
} satisfies Meta<typeof CoverageSection>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
