import LocaleSwitcher from "@/components/elementary/LocaleSwitcher"
import { GlobalContributorShortcuts } from "@/components/global/GlobalContributorShortcuts"
import { GlobalMobileMenu } from "@/components/global/GlobalMobileMenu"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { navLinks } from "../../fixtures/public/navigation"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Global/GlobalMobileMenu",
  component: GlobalMobileMenu,
  args: {
    links: navLinks,
    shortcuts: <GlobalContributorShortcuts />,
    actions: <LocaleSwitcher locale="en" />,
  },
  decorators: [
    (Story) => (
      <div
        className="storybook-mobile-header"
        style={{ position: "relative", minHeight: 600, maxWidth: 420 }}
      >
        <style>
          {
            ".storybook-mobile-header > div[class~='lg:hidden'] {display:block;}"
          }
        </style>
        <Story />
      </div>
    ),
  ],
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
    viewport: { defaultViewport: "mobile1" },
    docs: { story: { inline: false, iframeHeight: 800 } },
  },
} satisfies Meta<typeof GlobalMobileMenu>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
