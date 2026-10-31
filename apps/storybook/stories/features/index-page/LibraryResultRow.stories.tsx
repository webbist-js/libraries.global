import { LibraryResultRow } from "@/components/index-page/FindCards"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { findResult } from "../../fixtures/public/find"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Library search/LibraryResultRow",
  component: LibraryResultRow,
  args: {
    hit: findResult.hits[0]!,
    distanceKmValue: 1.8,
    now: new Date("2026-01-20T12:00:00Z"),
  },
  decorators: [
    (Story) => (
      <ul className="m-0 list-none p-0">
        <Story />
      </ul>
    ),
  ],
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof LibraryResultRow>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const NoPhoto: Story = {
  args: { hit: { ...findResult.hits[0]!, heroImage: null } },
}
export const PermanentlyClosed: Story = {
  args: {
    hit: { ...findResult.hits[0]!, operationalStatus: "permanently_closed" },
  },
}
