import { ResultRow } from "@/components/atlas/AtlasSearchResults"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/ResultRow",
  component: ResultRow,
  decorators: [
    (Story) => (
      <ul className="m-0 list-none p-0">
        <Story />
      </ul>
    ),
  ],
  args: {
    title: "Northbridge Library",
    sub: "Public library · Northbridge",
    icon: "book",
    onClick: fn(),
  },
} satisfies Meta<typeof ResultRow>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
