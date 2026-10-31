import { GlobalContributorShortcuts } from "@/components/global/GlobalContributorShortcuts"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"
import { editorSession } from "../../fixtures/public/session"

const meta = {
  title: "Features/Global/GlobalContributorShortcuts",
  component: GlobalContributorShortcuts,
  args: {},
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
    fixtureSession: editorSession,
    viewport: { defaultViewport: "mobile1" },
    docs: { story: { inline: false, iframeHeight: 800 } },
  },
} satisfies Meta<typeof GlobalContributorShortcuts>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
