import { HomepageFrame } from "@/components/home/HomepageFrame"
import { HomepageHero } from "@/components/home/HomepageHero"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { homepageContent, globeMarkers } from "../../fixtures/public/homepage"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Home/HomepageFrame",
  component: HomepageFrame,
  args: {
    children: (
      <HomepageHero
        eyebrow={homepageContent.heroEyebrow}
        title={homepageContent.heroTitle}
        text={homepageContent.heroText}
        markers={globeMarkers}
      />
    ),
  },
  decorators: [
    (Story) => (
      <div data-homepage>
        <Story />
      </div>
    ),
  ],
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
} satisfies Meta<typeof HomepageFrame>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
