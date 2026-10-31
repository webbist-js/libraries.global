import { LibraryNetworks } from "@/components/library/LibraryNetworks"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Library/LibraryNetworks",
  component: LibraryNetworks,
  args: {
    libraryId: "example-library",
    networks: [
      {
        documentId: "example-network",
        name: "Northbridge Library Service",
        slug: "northbridge-library-service",
        kind: "library_service",
        publicPageEnabled: true,
        publicPageReviewedAt: "2026-01-15",
      },
    ],
  },
} satisfies Meta<typeof LibraryNetworks>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { networks: [] } }
export const Unpublished: Story = {
  args: {
    networks: [
      {
        documentId: "draft-network",
        name: "Draft service",
        kind: "library_service",
        publicPageEnabled: false,
      },
    ],
  },
}
