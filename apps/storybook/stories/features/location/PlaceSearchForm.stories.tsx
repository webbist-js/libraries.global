import { PlaceSearchForm } from "@/components/location/PlaceSearchForm"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Location/PlaceSearchForm",
  component: PlaceSearchForm,
  args: { name: "Northbridge", level: "region", slug: "northbridge" },
} satisfies Meta<typeof PlaceSearchForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
