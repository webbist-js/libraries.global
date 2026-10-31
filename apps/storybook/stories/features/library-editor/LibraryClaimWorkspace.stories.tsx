import { LibraryClaimWorkspace } from "@/components/library-editor/LibraryClaimWorkspace"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: {
    docs: { story: { inline: false, height: "900px" } },
    fixtureResponses: geographyResponses,
  },
  title: "Features/Library editor/LibraryClaimWorkspace",
  component: LibraryClaimWorkspace,
  args: {
    initialLibrary: {
      libraryDocumentId: "example-library",
      librarySlug: "northbridge-library",
      libraryName: "Northbridge Community Library",
    },
    context: "contribute",
  },
} satisfies Meta<typeof LibraryClaimWorkspace>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
