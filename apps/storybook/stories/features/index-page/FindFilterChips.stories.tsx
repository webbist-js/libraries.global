import { DEFAULT_FIND_STATE } from "@/components/index-page/find-helpers"
import { FindFilterChips } from "@/components/index-page/FindControls"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Library search/FindFilterChips",
  component: FindFilterChips,
  args: {
    state: {
      ...DEFAULT_FIND_STATE,
      groups: ["public"],
      services: ["Printing"],
      needs: ["hours"],
      place: { level: "region", slug: "northbridge" },
    },
    placeName: "Northbridge",
    onChange: fn(),
    onClearAll: fn(),
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs()

    return (
      <InteractiveArgs args={args} onUpdate={updateArgs}>
        {(live, update) => (
          <FindFilterChips
            {...live}
            onChange={(patch) => {
              live.onChange(patch)
              update({ state: { ...live.state, ...patch } })
            }}
            onClearAll={() => {
              live.onClearAll()
              update({ state: DEFAULT_FIND_STATE })
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
} satisfies Meta<typeof FindFilterChips>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
