import { PlaceSearch } from "@/components/drives/PlaceSearch"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Drives/PlaceSearch",
  component: PlaceSearch,
  args: {
    id: "example-drive-place",
    locale: "en",
    chosen: [],
    invalid: false,
    onAdd: fn(),
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof PlaceSearch>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
