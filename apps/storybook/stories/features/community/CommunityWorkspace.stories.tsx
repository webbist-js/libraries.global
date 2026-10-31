import { CommunityWorkspace } from "@/components/community/CommunityWorkspace"
import { StandingCard } from "@/components/community/StandingCard"
import { SuggestionsBoard } from "@/components/community/SuggestionsBoard"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import {
  optionNames,
  suggestions,
  standing,
} from "../../fixtures/public/community"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Community/CommunityWorkspace",
  component: CommunityWorkspace,
  args: {
    counts: { noticeboard: 3, suggestions: 12 },
    standing: (
      <StandingCard
        standing={standing}
        signedIn
        initials="MS"
        signInReturnTo="/community"
      />
    ),
    children: (
      <SuggestionsBoard
        items={suggestions}
        filter="all"
        onFilterChange={fn()}
        onVote={fn(async () => ({ voted: true, votes: 25 }))}
        busyId={null}
        error={null}
        signedIn
        optionNames={optionNames}
        now={new Date("2026-01-20T12:00:00Z")}
      />
    ),
  },
  parameters: {
    docs: {
      story: { inline: false, iframeHeight: 900 },
      description: {
        component:
          "This example runs in its own iframe to keep fixture requests, caches and page landmarks independent. Open Canvas to use the interactive Controls.",
      },
    },
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
    react: { rsc: true },
  },
} satisfies Meta<typeof CommunityWorkspace>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
