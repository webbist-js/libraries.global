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

export const MultipleSources: Story = {
  args: {
    sources: [
      ...meta.args.sources,
      {
        title: "Northbridge population and neighbourhood statistics",
        url: "https://example.invalid/statistics",
        publisher: "Example Statistics Office",
        notes:
          "Population edition and reporting boundaries used for the comparison.",
      },
      {
        title: "Library service annual review",
        publisher: "Example Library Service",
        notes: "Print reference, pages 12–16.",
      },
    ],
  },
}
