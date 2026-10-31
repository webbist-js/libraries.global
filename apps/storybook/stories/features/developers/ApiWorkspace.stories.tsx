import { ApiWorkspace } from "@/components/developers/ApiWorkspace"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  profileResponses,
  readerSession,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Developers/ApiWorkspace",
  component: ApiWorkspace,
  args: {
    section: "overview",
    team: true,
    children: (
      <p>Published public library records for your website or research.</p>
    ),
  },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof ApiWorkspace>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
