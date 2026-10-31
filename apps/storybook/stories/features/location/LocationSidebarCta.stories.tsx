import { LocationSidebarCta } from "@/components/location/LocationSidebar"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Location/LocationSidebarCta",
  component: LocationSidebarCta,
  args: {
    name: "Northbridge",
    addHref: "/contribute",
    proposeHref: "/community/suggestions",
  },
} satisfies Meta<typeof LocationSidebarCta>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
