import { LibraryOpenStatusBadge } from "@/components/library/LibraryHoursTable"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { weeklyHours } from "../fixtures/opening-times"

const meta = {
  title: "Features/Library/Open status",
  component: LibraryOpenStatusBadge,
  args: {
    openingTimes: weeklyHours,
    timezone: "Europe/London",
    prominent: false,
  },
} satisfies Meta<typeof LibraryOpenStatusBadge>

export default meta
type Story = StoryObj<typeof meta>

export const Current: Story = {}
export const Prominent: Story = { args: { prominent: true } }
export const TemporarilyClosed: Story = {
  args: { operationalStatus: "temporarily_closed" },
}
export const PermanentlyClosed: Story = {
  args: { operationalStatus: "permanently_closed" },
}
export const Planned: Story = { args: { operationalStatus: "planned" } }
export const ByAppointment: Story = {
  args: { operationalStatus: "appointment_only" },
}
export const Unknown: Story = { args: { openingTimes: null } }
