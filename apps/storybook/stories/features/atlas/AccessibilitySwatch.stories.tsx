import { AccessibilitySwatch } from "@/components/atlas/AtlasAccessibility"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/AccessibilitySwatch",
  component: AccessibilitySwatch,
  args: { confirmed: true },
} satisfies Meta<typeof AccessibilitySwatch>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Unconfirmed: Story = { args: { confirmed: false } }
