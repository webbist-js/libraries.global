import { PublicNetworkAffiliations } from "@/components/networks/PublicNetworkAffiliations"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { asyncStory } from "../../../.storybook/AsyncStory"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Networks/PublicNetworkAffiliations",
  component: PublicNetworkAffiliations,
  render: asyncStory(PublicNetworkAffiliations),
  args: { username: "example-maya" },
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
} satisfies Meta<typeof PublicNetworkAffiliations>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
