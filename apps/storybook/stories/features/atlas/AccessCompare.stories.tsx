import { AccessCompare } from "@/components/atlas/AtlasAccessCompare"
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
          <AccessCompare
            {...args}
            setQuery={(query) => {
              args.setQuery?.(query)
              updateArgs({ query })
            }}
            setSort={(sort) => {
              args.setSort?.(sort)
              updateArgs({ sort })
            }}
            setDirection={(direction) => {
              args.setDirection(direction)
              const resolvedDirection =
                direction === "provisionLow"
                  ? args.metric === "per100k"
                    ? "asc"
                    : "desc"
                  : direction === "provisionHigh"
                    ? args.metric === "per100k"
                      ? "desc"
                      : "asc"
                    : direction
              updateArgs({ resolvedDirection })
            }}
            setPage={(currentPage) => {
              args.setPage?.(currentPage)
              updateArgs({ currentPage })
            }}
            onSelect={(selected) => {
              args.onSelect?.(selected)
              updateArgs({ selected })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },

  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/AccessCompare",
  component: AccessCompare,
  args: {
    metric: "per100k",
    scopeDescription: "Northbridge libraries",
    onSelect: fn(),
    selected: "example-district",
    showAllAreas: false,
    query: "",
    setQuery: fn(),
    sort: "name",
    setSort: fn(),
    resolvedDirection: "asc",
    setDirection: fn(),
    setPage: fn(),
    areaKind: "district",
    rows: accessResponse.areas,
    currentPage: 0,
  },
} satisfies Meta<typeof AccessCompare>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
