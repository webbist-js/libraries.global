import { AccessData } from "@/components/atlas/AtlasAccessViews"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { accessResponse } from "../../fixtures/geography/atlas"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/AccessData",
  component: AccessData,
  args: { response: accessResponse, area: accessResponse.areas[0] },
} satisfies Meta<typeof AccessData>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
