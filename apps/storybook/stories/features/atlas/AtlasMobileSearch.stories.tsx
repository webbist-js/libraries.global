import { AtlasMobileSearch } from "@/components/atlas/AtlasMobileSearch"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/AtlasMobileSearch",
  component: AtlasMobileSearch,
  args: {
    query: "",
    onPick: fn(),
    onStatus: fn(),
    libraryIds: new Set(["example-mobile"]),
  },
} satisfies Meta<typeof AtlasMobileSearch>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
