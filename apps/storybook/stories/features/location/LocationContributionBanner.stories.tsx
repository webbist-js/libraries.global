import { LocationContributionBanner } from "@/components/location/LocationContributionBanner"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Location/LocationContributionBanner",
  component: LocationContributionBanner,
  args: { name: "Northbridge", addHref: "/contribute" },
} satisfies Meta<typeof LocationContributionBanner>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
