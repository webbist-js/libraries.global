import { LibraryFeatureDetails } from "@/components/library/LibraryFeatureDetails"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Library/LibraryFeatureDetails",
  component: LibraryFeatureDetails,
  args: {
    name: "Step-free entrance",
    summary: "Use the entrance beside the community garden.",
    detailCategory: "Accessibility",
    children: (
      <p>
        The doorway is wide enough for wheelchairs and has an automatic opener.
      </p>
    ),
  },
} satisfies Meta<typeof LibraryFeatureDetails>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const MissingSummary: Story = {
  args: { summary: null, children: undefined },
}
