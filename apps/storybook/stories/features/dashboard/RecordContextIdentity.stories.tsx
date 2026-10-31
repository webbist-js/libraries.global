import { RecordContextIdentity } from "@/components/dashboard/RecordContextIdentity"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  profileResponses,
  readerSession,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Dashboard/RecordContextIdentity",
  component: RecordContextIdentity,
  args: { title: "Northbridge Community Library" },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof RecordContextIdentity>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
