import { FilterSidebar, useFilterSidebar } from "@/components/ds"
import { DEFAULT_FIND_STATE } from "@/components/index-page/find-helpers"
import { FindResultsControls } from "@/components/index-page/FindControls"
import { FindFilterSidebar } from "@/components/index-page/FindFilterSidebar"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import type { ComponentProps } from "react"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import { findResult } from "../../fixtures/public/find"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

function FindControlsExample(args: ComponentProps<typeof FindResultsControls>) {
  const sidebar = useFilterSidebar("storybook-find-controls")

  return (
    <div className="grid gap-4">
      <FindResultsControls {...args} sidebar={sidebar} />
      <FilterSidebar sidebar={sidebar} sticky={false}>
        <FindFilterSidebar
          state={args.state}
          facets={{ ...findResult.facets, location: findResult.location }}
          onChange={(state) => args.onChange(state)}
          onReset={() => args.onChange(DEFAULT_FIND_STATE)}
          sidebar={sidebar}
        />
      </FilterSidebar>
    </div>
  )
}
const meta = {
  title: "Features/Library search/FindResultsControls",
  component: FindResultsControls,
  args: {
    state: DEFAULT_FIND_STATE,
    total: 120,
    loading: false,
    onChange: fn(),
    onOpenFilters: fn(),
    activeFilterCount: 2,
    sidebar: {
      collapsed: false,
      hide: fn(),
      show: fn(),
      sidebarId: "example-sidebar",
      hideId: "example-hide",
      showId: "example-show",
    },
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs()

    return (
      <InteractiveArgs args={args} onUpdate={updateArgs}>
        {(live, update) => (
          <FindControlsExample
            {...live}
            onChange={(patch) => {
              live.onChange(patch)
              update({ state: { ...live.state, ...patch } })
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
} satisfies Meta<typeof FindResultsControls>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Loading: Story = { args: { loading: true, total: null } }
