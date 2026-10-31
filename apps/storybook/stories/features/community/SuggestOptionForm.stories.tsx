import { SuggestOptionForm } from "@/components/community/SuggestOptionForm"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import {
  optionNames,
  suggestions,
  reviewRound,
} from "../../fixtures/public/community"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Community/SuggestOptionForm",
  component: SuggestOptionForm,
  args: {
    signedIn: true,
    optionNames,
    suggestions,
    onPosted: fn(),
    onVote: fn(async () => ({ voted: true, votes: 25 })),
    busyId: null,
    round: reviewRound,
    voteError: null,
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof SuggestOptionForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const SignedOut: Story = { args: { signedIn: false } }
