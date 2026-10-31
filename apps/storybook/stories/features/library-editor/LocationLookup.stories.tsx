import { LocationLookup } from "@/components/library-editor/LocationLookup"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Library editor/LocationLookup",
  component: LocationLookup,
  args: { initialQuery: "Northbridge", onPick: fn(), onLocate: fn() },
} satisfies Meta<typeof LocationLookup>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
