import { LibraryHero } from "@/components/library/LibraryHero"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  completeLibrary,
  mobileLibrary,
  digitalLibrary,
  wizardLibrary,
  libraryResponses,
  libraryServerFixtures,
} from "../../fixtures/geography/library"
import { libraryFixture } from "../../fixtures/library"

const meta = {
  title: "Features/Library/LibraryHero",
  component: LibraryHero,
  args: {
    library: completeLibrary,
    wizardLibrary,
    coords: { lat: 51.5, lng: -0.1 },
    neighbours: [],
  },
  parameters: {
    docs: { story: { inline: false, height: "900px" } },

    fixtureResponses: libraryResponses,
    serverFixtures: libraryServerFixtures,
    layout: "fullscreen",
  },
} satisfies Meta<typeof LibraryHero>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const NoMap: Story = { args: { coords: null, library: libraryFixture } }
export const Mobile: Story = { args: { library: mobileLibrary } }
export const Digital: Story = { args: { library: digitalLibrary } }
