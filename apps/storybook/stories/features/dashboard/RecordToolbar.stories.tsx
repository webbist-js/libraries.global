import { RecordToolbar } from "@/components/dashboard/RecordToolbar"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  profileResponses,
  readerSession,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Dashboard/RecordToolbar",
  component: RecordToolbar,
  args: {},
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof RecordToolbar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
