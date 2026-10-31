import { NoticeboardHeroActions } from "@/app/[locale]/(dashboard)/community/_components/NoticeboardHeroActions"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Community/Routes/NoticeboardHeroActions",
  component: NoticeboardHeroActions,
  args: { board: false, signedIn: true, openCount: 3, helping: 24 },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof NoticeboardHeroActions>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const BoardMember: Story = { args: { board: true } }
export const SignedOut: Story = { args: { signedIn: false } }
export const NoOpenDrives: Story = { args: { openCount: 0, helping: 0 } }
