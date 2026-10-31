import { LibraryHoursTable } from "@/components/library/LibraryHoursTable"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect } from "storybook/test"

import {
  overnightHours,
  splitHours,
  weeklyHours,
} from "../fixtures/opening-times"

const meta = {
  title: "Features/Library/Opening hours",
  component: LibraryHoursTable,
  args: {
    openingTimes: weeklyHours,
    timezone: "Europe/London",
    compact: false,
    dashboard: false,
  },
  decorators: [
    (Story) => (
      <div className="max-w-3xl">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "The production weekly hours display, including staffed/self-service periods and overnight carry-over. Today and open status use the browser clock in the library’s timezone.",
      },
    },
  },
} satisfies Meta<typeof LibraryHoursTable>

export default meta
type Story = StoryObj<typeof meta>

export const Weekly: Story = {}
export const SplitSessions: Story = {
  args: { openingTimes: splitHours, compact: true },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByText("09:00–12:30").length).toBeGreaterThan(0)
    await expect(canvas.getAllByText("13:30–18:00").length).toBeGreaterThan(0)
    await expect(canvas.queryByText("09:00–18:00")).not.toBeInTheDocument()
  },
}
export const Compact: Story = {
  args: { openingTimes: splitHours, compact: true },
}
export const Dashboard: Story = {
  args: { openingTimes: splitHours, dashboard: true },
}
export const Overnight: Story = { args: { openingTimes: overnightHours } }
export const Missing: Story = { args: { openingTimes: null } }
export const NarrowFrench: Story = {
  args: { openingTimes: splitHours, compact: true },
  globals: { locale: "fr" },
  decorators: [
    (Story) => (
      <div style={{ width: 320, maxWidth: "100%" }}>
        <Story />
      </div>
    ),
  ],
}
