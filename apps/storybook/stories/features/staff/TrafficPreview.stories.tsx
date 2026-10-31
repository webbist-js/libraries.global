import { TrafficPreview } from "@/app/[locale]/(dashboard)/staff/[slug]/_components/TrafficPreview"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Staff/TrafficPreview",
  component: TrafficPreview,
  args: {
    summary: {
      range: 7,
      sample: true,
      kpis: [
        { key: "views", label: "Record views", value: 1240, changePct: 12 },
      ],
      viewsPerDay: [{ date: "2026-01-15", value: 240 }],
      referrers: [{ label: "Library index", pct: 60 }],
      searches: [{ query: "northbridge", count: 12 }],
    },
    rangeHref: (range) => `?range=${range}`,
  },
} satisfies Meta<typeof TrafficPreview>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
