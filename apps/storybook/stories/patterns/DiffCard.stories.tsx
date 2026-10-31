import { DiffCard } from "@/components/ds/DiffCard"
import { Button } from "@/components/ui/button"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Patterns/DiffCard",
  component: DiffCard,
  args: {
    title: "Opening hours",
    byline: "Suggested by Example Contributor · 15 January 2026",
    rows: [{ label: "Monday", now: "09:00–17:00", suggested: "09:00–18:00" }],
    evidence: "Library noticeboard, 14 January 2026",
    actions: (
      <>
        <Button variant="primary">Accept change</Button>
        <Button variant="surface">Request more information</Button>
      </>
    ),
  },
} satisfies Meta<typeof DiffCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Published: Story = {
  args: { footer: "Published. Credited to Example Contributor." },
}
