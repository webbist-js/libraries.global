import { JournalSources } from "@/components/blog/JournalSources"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Blog/JournalSources",
  component: JournalSources,
  args: {
    sources: [
      {
        title: "Northbridge Library annual report",
        url: "https://example.invalid/report",
        publisher: "Example Library Service",
        accessedAt: "2026-01-15",
        notes: "Opening hours and collection statistics.",
      },
    ],
  },
} satisfies Meta<typeof JournalSources>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
