import { DEFAULT_FIND_STATE } from "@/components/index-page/find-helpers"
import { FindFilterSidebar } from "@/components/index-page/FindFilterSidebar"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import { findResult } from "../../fixtures/public/find"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Library search/FindFilterSidebar",
  component: FindFilterSidebar,
  args: {
    state: DEFAULT_FIND_STATE,
    facets: { ...findResult.facets, location: findResult.location },
    onChange: fn(),
    onReset: fn(),
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs()

    return (
      <InteractiveArgs args={args} onUpdate={updateArgs}>
        {(live, update) => (
          <FindFilterSidebar
            {...live}
            onChange={(patch) => {
              live.onChange(patch)
              update({ state: { ...live.state, ...patch } })
            }}
            onReset={() => {
              live.onReset()
              update({ state: DEFAULT_FIND_STATE })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 360 }}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof FindFilterSidebar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
