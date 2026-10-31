import { LibraryClaimForm } from "@/components/library-editor/LibraryClaimForm"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Library editor/LibraryClaimForm",
  component: LibraryClaimForm,
  args: {
    library: {
      libraryDocumentId: "example-library",
      librarySlug: "northbridge-library",
      libraryName: "Northbridge Community Library",
    },
    onSuccess: fn(),
    onPendingChange: fn(),
  },
} satisfies Meta<typeof LibraryClaimForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
