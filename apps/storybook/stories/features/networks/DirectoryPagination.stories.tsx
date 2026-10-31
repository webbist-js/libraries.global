import { DirectoryPagination } from "@/components/networks/DirectoryPagination"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Networks/DirectoryPagination",
  component: DirectoryPagination,
  args: {
    basePath: "/library-networks",
    query: new URLSearchParams(),
    page: 2,
    pageSize: 20,
    total: 75,
    label: "Services and networks",
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof DirectoryPagination>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
