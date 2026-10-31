import { LibraryTodayFact } from "@/components/library/LibraryHoursTable"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { weeklyHours, splitHours } from "../fixtures/opening-times"

const meta = {
  title: "Features/Library/Today",
  component: LibraryTodayFact,
  args: { openingTimes: weeklyHours, timezone: "Europe/London" },
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LibraryTodayFact>

export default meta
type Story = StoryObj<typeof meta>

export const RecordedHours: Story = {}
export const SplitSessions: Story = { args: { openingTimes: splitHours } }
export const Missing: Story = { args: { openingTimes: null } }
