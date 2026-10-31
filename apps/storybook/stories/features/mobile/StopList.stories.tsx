import { StopList } from "@/components/mobile/live/LiveConsoleScreens"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Mobile/StopList",
  component: StopList,
  args: {
    stops: [
      {
        visitId: "example-first",
        name: "Market Square",
        arrive: "09:30",
        depart: "10:15",
        state: "done",
      },
      {
        visitId: "example-second",
        name: "Garden Village",
        arrive: "11:00",
        depart: "11:45",
        state: "here",
      },
    ],
  },
} satisfies Meta<typeof StopList>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
