import { MobileHeroFacts } from "@/components/mobile/MobileHeroFacts"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { timetable } from "../../fixtures/geography/mobile"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Mobile/MobileHeroFacts",
  component: MobileHeroFacts,
  args: { tt: timetable, notices: [], timezone: "Europe/London" },
} satisfies Meta<typeof MobileHeroFacts>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const MissingTimetable: Story = { args: { tt: null } }
