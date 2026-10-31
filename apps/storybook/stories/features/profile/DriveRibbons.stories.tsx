import { DriveRibbons } from "@/app/[locale]/profile/[username]/_components/sections/DriveRibbons"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  profile,
  profileResponses,
  readerSession,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Profile/DriveRibbons",
  component: DriveRibbons,
  args: { username: profile.username },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false, height: "800px" } },
  },
} satisfies Meta<typeof DriveRibbons>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
