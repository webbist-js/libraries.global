import { LocationHelpPanel } from "@/components/location/LocationHelpPanel"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Location/LocationHelpPanel",
  component: LocationHelpPanel,
  args: {
    name: "Northbridge",
    body: "Help keep the library index useful by adding missing details and a public source.",
    addHref: "/contribute",
  },
} satisfies Meta<typeof LocationHelpPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
