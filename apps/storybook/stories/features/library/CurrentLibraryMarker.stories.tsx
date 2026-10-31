import { CurrentLibraryMarker } from "@/components/library/CurrentLibraryMarker"
import { useCurrentLibrary } from "@/lib/staff/current-library"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Library/CurrentLibraryMarker",
  component: CurrentLibraryMarker,
  args: { documentId: "example-library" },
  render: function Render(args) {
    const current = useCurrentLibrary()

    return (
      <div className="grid gap-3 rounded-xl border p-5">
        <CurrentLibraryMarker {...args} />
        <p className="m-0">
          The staff drawer reads the current page’s library from this marker.
        </p>
        <output aria-label="Current library for the staff drawer">
          {current ?? "No library selected"}
        </output>
      </div>
    )
  },
  parameters: { docs: { story: { inline: false, height: "240px" } } },
} satisfies Meta<typeof CurrentLibraryMarker>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Cleared: Story = { args: { documentId: null } }
