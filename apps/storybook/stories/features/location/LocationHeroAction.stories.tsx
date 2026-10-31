import { LocationHeroAction } from "@/components/location/LocationHero"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Location/LocationHeroAction",
  component: LocationHeroAction,
  args: {
    href: "/libraries",
    icon: "mdi:library-outline",
    children: "Browse libraries",
    primary: true,
  },
} satisfies Meta<typeof LocationHeroAction>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
