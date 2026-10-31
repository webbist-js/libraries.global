import LocaleSwitcher from "@/components/elementary/LocaleSwitcher"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Global/Locale switcher",
  component: LocaleSwitcher,
  args: { locale: "en" },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
    docs: {
      story: { inline: false, iframeHeight: 800 },
      description: {
        component:
          "This example uses its own iframe to keep fixture transport and panel state independent. Open Canvas for interactive Controls.",
      },
    },
  },
} satisfies Meta<typeof LocaleSwitcher>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const French: Story = { args: { locale: "fr" } }
export const Czech: Story = { args: { locale: "cs" } }
