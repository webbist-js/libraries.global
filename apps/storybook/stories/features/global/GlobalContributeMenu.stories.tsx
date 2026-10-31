import { GlobalContributeMenu } from "@/components/global/GlobalContributeMenu"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"
import { contributorSession } from "../../fixtures/public/session"

const meta = {
  title: "Features/Global/GlobalContributeMenu",
  component: GlobalContributeMenu,
  args: {},
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
    fixtureSession: contributorSession,
    docs: { story: { inline: false, iframeHeight: 800 } },
  },
} satisfies Meta<typeof GlobalContributeMenu>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
