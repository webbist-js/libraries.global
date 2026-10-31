import { TypeBadge } from "@/components/atlas/atlas-ui"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/TypeBadge",
  component: TypeBadge,
  args: { group: "public" },
} satisfies Meta<typeof TypeBadge>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Special: Story = { args: { group: "special" } }
