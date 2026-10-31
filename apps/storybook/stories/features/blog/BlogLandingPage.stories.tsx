import { BlogLandingPage } from "@/components/blog/BlogLandingPage"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { journalLanding } from "../../fixtures/public/articles"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Blog/BlogLandingPage",
  component: BlogLandingPage,
  args: { data: journalLanding, locale: "en" },
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
} satisfies Meta<typeof BlogLandingPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
