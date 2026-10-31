import { DriveFocusChip } from "@/components/drives/DriveFocusChip"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { drive } from "../../fixtures/public/drives"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Drives/DriveFocusChip",
  component: DriveFocusChip,
  args: { focus: drive.focus },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof DriveFocusChip>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Verification: Story = {
  args: {
    focus: { kind: "verify", sections: ["hours"], before: "2025-01-01" },
  },
}
export const Completeness: Story = {
  args: { focus: { kind: "record", target: 75 } },
}
