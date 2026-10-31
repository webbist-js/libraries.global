import { SuggestionsWorkspace } from "@/components/community/SuggestionsWorkspace"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

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
  title: "Features/Community/SuggestionsWorkspace",
  component: SuggestionsWorkspace,
  args: {
    initial: suggestions,
    optionNames,
    signedIn: true,
    round: reviewRound,
    now: "2026-01-20T12:00:00Z",
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
} satisfies Meta<typeof SuggestionsWorkspace>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
