import { FinalCtaSection } from "@/components/home/sections/FinalCtaSection"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { homepageContent } from "../../fixtures/public/homepage"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Home/FinalCtaSection",
  component: FinalCtaSection,
  args: {
    band: homepageContent.finalCta,
    benefits: homepageContent.communitySteps,
    signedIn: false,
    contained: true,
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
} satisfies Meta<typeof FinalCtaSection>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const SignedIn: Story = { args: { signedIn: true } }
