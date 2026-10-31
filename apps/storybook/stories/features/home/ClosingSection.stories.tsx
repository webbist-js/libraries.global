import { ClosingSection } from "@/components/home/sections/ClosingSection"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { homepageContent } from "../../fixtures/public/homepage"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Home/ClosingSection",
  component: ClosingSection,
  args: {
    band: homepageContent.finalCta,
    trustItems: homepageContent.trustItems,
    openLinks: homepageContent.openLinks,
    plansIntro: homepageContent.plansIntro,
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
} satisfies Meta<typeof ClosingSection>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
