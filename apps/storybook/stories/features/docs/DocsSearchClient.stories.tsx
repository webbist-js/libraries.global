import { DocsSearchClient } from "@/app/[locale]/(dashboard)/knowledge/search/_components/SearchClient"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Docs/Routes/DocsSearchClient",
  component: DocsSearchClient,
  args: {},
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof DocsSearchClient>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
