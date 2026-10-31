import { LibraryCommunity } from "@/components/library/LibraryCommunity"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  completeLibrary,
  libraryResponses,
  libraryServerFixtures,
} from "../../fixtures/geography/library"

const meta = {
  title: "Features/Library/LibraryCommunity",
  component: LibraryCommunity,
  args: { id: completeLibrary.documentId, locale: "en", contentLocale: "en" },
  parameters: {
    docs: { story: { inline: false, height: "900px" } },
    react: { rsc: true },
    fixtureResponses: libraryResponses,
    serverFixtures: libraryServerFixtures,
  },
} satisfies Meta<typeof LibraryCommunity>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
