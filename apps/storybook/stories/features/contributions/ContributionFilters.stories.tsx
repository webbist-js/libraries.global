import { ContributionFilters } from "@/components/contributions/ContributionFilters"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Contributions/ContributionFilters",
  component: ContributionFilters,
  args: {
    legend: "Contribution status",
    options: [
      { id: "all", label: "All" },
      { id: "approved", label: "Approved" },
      { id: "pending", label: "In review" },
    ],
    active: "all",
    counts: { all: 2, approved: 1, pending: 1 },
    onChange: fn(),
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs()

    return (
      <InteractiveArgs args={args} onUpdate={updateArgs}>
        {(live, update) => (
          <ContributionFilters
            {...live}
            onChange={(active) => {
              live.onChange(active)
              update({ active })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof ContributionFilters>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
