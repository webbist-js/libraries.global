import { ExceptionButtons } from "@/components/mobile/live/LiveConsoleScreens"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Mobile/ExceptionButtons",
  component: ExceptionButtons,
  args: { onSkip: fn(), onBreakdown: fn() },
} satisfies Meta<typeof ExceptionButtons>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
