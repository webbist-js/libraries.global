import { AtlasSection } from "@/components/home/sections/AtlasSection"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { homepageContent } from "../../fixtures/public/homepage"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Home/AtlasSection",
  component: AtlasSection,
  args: {
    band: homepageContent.atlasBand,
    image: {
      url: "/library-placeholder.svg",
      alternativeText: "Synthetic library illustration",
    },
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
} satisfies Meta<typeof AtlasSection>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
