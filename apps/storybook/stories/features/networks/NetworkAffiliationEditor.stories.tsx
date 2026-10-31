import { NetworkAffiliationEditor } from "@/components/networks/NetworkAffiliationEditor"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Networks/NetworkAffiliationEditor",
  component: NetworkAffiliationEditor,
  args: {},
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
  },
} satisfies Meta<typeof NetworkAffiliationEditor>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
