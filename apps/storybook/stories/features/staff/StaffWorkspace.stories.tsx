import { StaffWorkspace } from "@/components/staff/StaffWorkspace"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  readerSession,
  profileResponses,
} from "../../fixtures/workspace/profile"
import { staffLibrary } from "../../fixtures/workspace/staff"

const meta = {
  title: "Features/Staff/StaffWorkspace",
  component: StaffWorkspace,
  args: {
    children: <p>Your library records and verified staff tools.</p>,
    libraries: [staffLibrary],
    adding: false,
    guideHref: "/knowledge/staff",
  },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof StaffWorkspace>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
