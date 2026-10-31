import { LibraryEvents } from "@/components/library/LibraryEvents"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  libraryResponses,
  libraryServerFixtures,
} from "../../fixtures/geography/library"

const meta = {
  title: "Features/Library/LibraryEvents",
  component: LibraryEvents,
  args: { entityRef: "EXAMPLE-LIBRARY", hasActiveFeed: true },
  parameters: {
    docs: { story: { inline: false, height: "900px" } },
    fixtureResponses: libraryResponses,
    serverFixtures: libraryServerFixtures,
  },
} satisfies Meta<typeof LibraryEvents>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Unlinked: Story = {
  args: { entityRef: null, hasActiveFeed: false },
}
