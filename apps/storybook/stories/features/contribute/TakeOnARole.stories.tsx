import { TakeOnARole } from "@/app/[locale]/(dashboard)/contribute/_components/hub/TakeOnARole"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Contribute/Routes/TakeOnARole",
  component: TakeOnARole,
  args: {
    signedIn: true,
    hasClaim: false,
    isEditor: false,
    isModerator: false,
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof TakeOnARole>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const SignedOut: Story = { args: { signedIn: false } }
export const OnlyModeration: Story = {
  args: { hasClaim: true, isEditor: true },
}
