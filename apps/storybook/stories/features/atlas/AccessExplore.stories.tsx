import { AccessExplore } from "@/components/atlas/AtlasAccessViews"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import { accessResponse } from "../../fixtures/geography/atlas"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <AccessExplore
            {...args}
            setAreaQuery={(areaQuery) => {
              args.setAreaQuery?.(areaQuery)
              updateArgs({ areaQuery })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },

  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/AccessExplore",
  component: AccessExplore,
  args: {
    area: accessResponse.areas[0],
    metric: "per100k",
    areaQuery: "",
    setAreaQuery: fn(),
    exploreAreas: accessResponse.areas,
    onSelect: fn(),
    onFit: fn(),
  },
} satisfies Meta<typeof AccessExplore>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
