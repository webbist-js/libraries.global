import { QuickFixes } from "@/app/[locale]/(dashboard)/contribute/_components/hub/QuickFixes"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { incompleteRecords } from "../../fixtures/public/routes"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Contribute/Routes/QuickFixes",
  component: QuickFixes,
  args: { records: incompleteRecords },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
  decorators: [
    (Story, context) => (
      <div
        style={{
          containerType: "inline-size",
          containerName: "dashboard-content",
          maxWidth: context.parameters.narrow ? 380 : undefined,
        }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof QuickFixes>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Narrow: Story = { parameters: { narrow: true } }
export const Dark: Story = { globals: { appearance: "dark" } }
export const LongLibraryName: Story = {
  args: {
    records: incompleteRecords.map((record, index) =>
      index === 0
        ? {
            ...record,
            name: "Northbridge University Library, Special Collections and Community Archive",
          }
        : record
    ),
  },
}
