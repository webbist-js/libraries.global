import { NewLibraryPanel } from "@/components/moderation/NewLibraryPanel"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Moderation/NewLibraryPanel",
  component: NewLibraryPanel,
  args: {
    documentId: "example-new-library",
    status: "pending",
    fields: { name: "Northbridge Library", address: "1 Example Square" },
    draftData: { name: "Northbridge Library" },
  },
} satisfies Meta<typeof NewLibraryPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
