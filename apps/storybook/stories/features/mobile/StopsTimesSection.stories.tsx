import { StopsTimesSection } from "@/components/mobile/StopsTimesSection"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { timetable } from "../../fixtures/geography/mobile"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Mobile/StopsTimesSection",
  component: StopsTimesSection,
  args: {
    id: "example-mobile",
    name: "Northbridge Mobile Library",
    value: timetable,
    timezone: "Europe/London",
    notices: [],
  },
} satisfies Meta<typeof StopsTimesSection>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const MissingTimetable: Story = { args: { value: null } }
