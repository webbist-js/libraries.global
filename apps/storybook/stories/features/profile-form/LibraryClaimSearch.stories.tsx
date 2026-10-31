import { LibraryClaimSearch } from "@/components/profile-form/LibraryClaimSearch"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import {
  profileResponses,
  readerSession,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Profile form/LibraryClaimSearch",
  component: LibraryClaimSearch,
  args: { onClaimed: fn() },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof LibraryClaimSearch>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
