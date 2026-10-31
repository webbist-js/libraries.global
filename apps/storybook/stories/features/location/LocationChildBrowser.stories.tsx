import { LocationChildBrowser } from "@/components/location/LocationChildBrowser"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Location/LocationChildBrowser",
  component: LocationChildBrowser,
  args: {
    id: "example-places",
    title: "Regions",
    description: "Explore the library index by region.",
    items: [
      {
        slug: "northbridge",
        name: "Northbridge",
        href: "/europe/example-country/northbridge",
        count: 24,
        coverage: "18 records with opening hours",
      },
      {
        slug: "eastmere",
        name: "Eastmere",
        href: "/europe/example-country/eastmere",
        count: 12,
      },
    ],
    noun: { singular: "region", plural: "regions" },
    addHref: "/contribute",
  },
} satisfies Meta<typeof LocationChildBrowser>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { items: [] } }
