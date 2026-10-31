import { AccessibilityMapKey } from "@/components/atlas/AtlasAccessibility"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/AccessibilityMapKey",
  component: AccessibilityMapKey,
  args: { view: "compare" },
} satisfies Meta<typeof AccessibilityMapKey>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
