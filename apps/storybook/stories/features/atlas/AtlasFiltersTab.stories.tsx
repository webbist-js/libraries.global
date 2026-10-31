import { EMPTY_FILTERS } from "@/components/atlas/atlas.logic"
import { AtlasFiltersTab } from "@/components/atlas/AtlasFiltersTab"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import { atlasLibraries } from "../../fixtures/geography/atlas"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <AtlasFiltersTab
            {...args}
            onChange={(filters) => {
              args.onChange?.(filters)
              updateArgs({ filters })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },

  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/AtlasFiltersTab",
  component: AtlasFiltersTab,
  args: {
    filters: EMPTY_FILTERS,
    onChange: fn(),
    libraries: atlasLibraries,
    matchCount: 2,
    now: new Date("2026-01-15T12:00:00Z"),
    onShowResults: fn(),
  },
} satisfies Meta<typeof AtlasFiltersTab>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
