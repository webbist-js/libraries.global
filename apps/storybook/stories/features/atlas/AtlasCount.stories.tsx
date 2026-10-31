import { AtlasCount } from "@/components/atlas/AtlasBottomBar"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/AtlasCount",
  component: AtlasCount,
  args: { count: 24, sub: "Libraries in view" },
} satisfies Meta<typeof AtlasCount>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Loading: Story = { args: { loading: true } }
