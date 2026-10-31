import { RecordsThatNeedYou } from "@/app/[locale]/(dashboard)/contribute/_components/hub/RecordsThatNeedYou"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { incompleteRecords } from "../../fixtures/public/routes"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Contribute/Routes/RecordsThatNeedYou",
  component: RecordsThatNeedYou,
  args: {
    records: incompleteRecords,
    continents: [
      { name: "Europe", count: 480 },
      { name: "Africa", count: 120 },
    ],
    totalPublished: 1200,
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof RecordsThatNeedYou>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const EmptyRecords: Story = { args: { records: [] } }
