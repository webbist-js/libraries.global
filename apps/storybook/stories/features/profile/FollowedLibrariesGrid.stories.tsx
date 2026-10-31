import { FollowedLibrariesGrid } from "@/app/[locale]/profile/[username]/_components/FollowedLibrariesGrid"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  profile,
  profileResponses,
  readerSession,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Profile/FollowedLibrariesGrid",
  component: FollowedLibrariesGrid,
  args: { libraries: profile.followedLibraries!, username: profile.username },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false, height: "800px" } },
  },
} satisfies Meta<typeof FollowedLibrariesGrid>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { libraries: [] } }
