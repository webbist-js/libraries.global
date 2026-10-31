import { ContributionJourney } from "@/app/[locale]/(dashboard)/contribute/_components/hub/ContributionJourney"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Contribute/Routes/ContributionJourney",
  component: ContributionJourney,
  args: {
    signedIn: true,
    hasClaim: false,
    isEditor: false,
    isModerator: false,
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof ContributionJourney>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const ExperiencedEditor: Story = {
  args: { isEditor: true, hasClaim: true },
}
