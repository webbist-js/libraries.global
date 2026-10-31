import { ApiPlayground } from "@/components/developers/ApiPlayground"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  profileResponses,
  readerSession,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Developers/ApiPlayground",
  component: ApiPlayground,
  args: { teamName: "Example Library Team" },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof ApiPlayground>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
