import { BlogSearchClient } from "@/app/[locale]/(dashboard)/journal/search/_components/SearchClient"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Blog/Routes/BlogSearchClient",
  component: BlogSearchClient,
  args: {},
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof BlogSearchClient>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
