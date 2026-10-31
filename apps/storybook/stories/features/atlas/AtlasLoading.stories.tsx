import { AtlasLoading } from "@/components/atlas/AtlasEdgeStates"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/AtlasLoading",
  component: AtlasLoading,
  args: { listReady: true, onOpenList: fn() },
} satisfies Meta<typeof AtlasLoading>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Fetching: Story = { args: { listReady: false } }
