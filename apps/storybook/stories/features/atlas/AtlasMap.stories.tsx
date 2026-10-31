import { AtlasMap } from "@/components/atlas/AtlasMap"
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
          <AtlasMap
            {...args}
            onSelect={(selected) => {
              args.onSelect?.(selected)
              updateArgs({
                selected:
                  args.libraries.find((library) => library.id === selected) ??
                  null,
              })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },

  parameters: {
    docs: { story: { inline: false, height: "900px" } },
    fixtureResponses: geographyResponses,
  },
  title: "Features/Atlas/AtlasMap",
  component: AtlasMap,
  args: {
    libraries: atlasLibraries,
    closures: [],
    layers: ["pins"],
    heatOpacity: 0.65,
    selected: null,
    hovered: null,
    projection: "flat",
    initialView: { lat: 51.5, lng: -0.1, zoom: 10 },
    padding: { left: 0, right: 0, bottom: 0 },
    onSelect: fn(),
    onView: fn(),
    onReady: fn(),
    onError: fn(),
    className: "h-[600px] w-full",
  },
  decorators: [
    (Story) => (
      <div className="relative min-h-[600px] max-w-4xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AtlasMap>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const DarkStreet: Story = {
  globals: { appearance: "dark" },
  args: { initialView: { lat: 51.5, lng: -0.1, zoom: 14 } },
}

export const DarkGlobe: Story = {
  globals: { appearance: "dark" },
  args: {
    projection: "globe",
    initialView: { lat: 51.5, lng: -0.1, zoom: 2 },
  },
}
