import { LiveSessionsTable } from "@/components/mobile/live/LiveSessionsTable"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { sessionLogs } from "../../fixtures/geography/mobile"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Mobile/LiveSessionsTable",
  component: LiveSessionsTable,
  args: { logs: sessionLogs, timezone: "Europe/London" },
} satisfies Meta<typeof LiveSessionsTable>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { logs: [] } }
