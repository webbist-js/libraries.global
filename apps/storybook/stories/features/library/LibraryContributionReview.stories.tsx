import { LibraryContributionReview } from "@/components/library/LibraryContributionReview"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { editorSubmission } from "../../fixtures/library-editor"

const meta = {
  title: "Features/Library/LibraryContributionReview",
  component: LibraryContributionReview,
  args: { fields: editorSubmission.fields },
  parameters: { fixtureResponses: {} },
} satisfies Meta<typeof LibraryContributionReview>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Dark: Story = { globals: { appearance: "dark" } }
