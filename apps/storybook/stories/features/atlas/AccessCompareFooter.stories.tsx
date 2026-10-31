import { AccessCompareFooter } from "@/components/atlas/AtlasAccessCompare"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <AccessCompareFooter
            {...args}
            setPage={(currentPage) => {
              args.setPage?.(currentPage)
              updateArgs({ currentPage })
            }}
            setShowAllAreas={(showAllAreas) => {
              args.setShowAllAreas?.(showAllAreas)
              updateArgs({ showAllAreas })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },

  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/AccessCompareFooter",
  component: AccessCompareFooter,
  args: {
    total: 24,
    showAllAreas: false,
    setShowAllAreas: fn(),
    currentPage: 0,
    setPage: fn(),
  },
} satisfies Meta<typeof AccessCompareFooter>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
