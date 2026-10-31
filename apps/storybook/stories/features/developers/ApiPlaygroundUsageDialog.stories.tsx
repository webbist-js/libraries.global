import { ApiPlaygroundUsageDialog } from "@/components/developers/ApiPlaygroundUsageDialog"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import {
  profileResponses,
  readerSession,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Developers/ApiPlaygroundUsageDialog",
  component: ApiPlaygroundUsageDialog,
  args: { teamName: "Example Library Team", onDismiss: fn() },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof ApiPlaygroundUsageDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
