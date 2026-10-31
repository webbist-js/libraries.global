import { PinGlyph } from "@/components/atlas/atlas-ui"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/PinGlyph",
  component: PinGlyph,
  args: { group: "public", size: 28 },
} satisfies Meta<typeof PinGlyph>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Academic: Story = { args: { group: "academic" } }
export const Mobile: Story = { args: { group: "mobile" } }
