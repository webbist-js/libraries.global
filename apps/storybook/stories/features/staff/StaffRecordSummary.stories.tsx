import { StaffRecordSummary } from "@/components/staff/StaffRecordSummary"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  readerSession,
  profileResponses,
} from "../../fixtures/workspace/profile"
import { staffLibrary, staffResponses } from "../../fixtures/workspace/staff"

const meta = {
  title: "Features/Staff/StaffRecordSummary",
  component: StaffRecordSummary,
  args: { userId: readerSession.user.id, library: staffLibrary },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: { ...profileResponses, ...staffResponses },
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof StaffRecordSummary>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Unavailable: Story = {
  parameters: {
    fixtureResponses: {
      "GET /api/staff/example-library/overview": {
        status: 503,
        body: { error: "unavailable" },
      },
    },
    docs: { story: { inline: false } },
  },
}
