import { MutedChip } from "@/components/atlas/atlas-ui"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/MutedChip",
  component: MutedChip,
  args: { children: "Two libraries" },
} satisfies Meta<typeof MutedChip>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
