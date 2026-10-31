import { LibraryReuseSection } from "@/components/library/LibrarySections"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  completeLibrary,
  libraryPath,
  libraryResponses,
  libraryServerFixtures,
} from "../../fixtures/geography/library"

const meta = {
  title: "Features/Library/LibraryReuseSection",
  component: LibraryReuseSection,
  args: {
    library: completeLibrary,
    url: "https://example.invalid" + libraryPath,
  },
  parameters: {
    docs: { story: { inline: false, height: "900px" } },
    fixtureResponses: libraryResponses,
    serverFixtures: libraryServerFixtures,
  },
} satisfies Meta<typeof LibraryReuseSection>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Embedded: Story = { args: { embedded: true } }
