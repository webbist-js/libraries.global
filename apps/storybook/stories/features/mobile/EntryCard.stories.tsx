import { EntryCard } from "@/components/mobile/live/LiveConsoleScreens"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Mobile/EntryCard",
  component: EntryCard,
  args: {
    name: "Northbridge Mobile Library",
    meta: "Market Square · Garden Village",
    action: <button type="button">View service</button>,
  },
} satisfies Meta<typeof EntryCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
