import { ProposeBand } from "@/app/[locale]/(dashboard)/community/_components/ProposeBand"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Community/Routes/ProposeBand",
  component: ProposeBand,
  args: {
    board: false,
    signedIn: true,
    howHref: "/knowledge/community-drives",
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof ProposeBand>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const SignedOut: Story = { args: { signedIn: false } }
export const BoardMember: Story = { args: { board: true } }
