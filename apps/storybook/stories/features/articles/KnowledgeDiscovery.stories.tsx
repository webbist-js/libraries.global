import { KnowledgeDiscovery } from "@/components/articles/KnowledgeDiscovery"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { discovery } from "../../fixtures/public/articles"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Articles/KnowledgeDiscovery",
  component: KnowledgeDiscovery,
  args: { discovery, locale: "en" },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof KnowledgeDiscovery>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
