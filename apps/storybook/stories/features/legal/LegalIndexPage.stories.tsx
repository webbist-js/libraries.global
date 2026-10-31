import { LegalIndexPage } from "@/components/legal/LegalIndexPage"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { legalDocuments } from "../../fixtures/public/homepage"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Legal/LegalIndexPage",
  component: LegalIndexPage,
  args: { locale: "en", documents: legalDocuments },
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
} satisfies Meta<typeof LegalIndexPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
