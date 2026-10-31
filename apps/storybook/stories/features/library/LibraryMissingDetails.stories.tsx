import { LibraryMissingDetails } from "@/components/library/LibraryMissingDetails"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  libraryResponses,
  libraryServerFixtures,
} from "../../fixtures/geography/library"
import { libraryFixture } from "../../fixtures/library"

const meta = {
  title: "Features/Library/LibraryMissingDetails",
  component: LibraryMissingDetails,
  args: {
    library: libraryFixture,
    missing: ["transport", "admission", "events"],
    addHref: "/contribute/index/new",
  },
  parameters: {
    fixtureResponses: libraryResponses,
    serverFixtures: libraryServerFixtures,
  },
} satisfies Meta<typeof LibraryMissingDetails>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
