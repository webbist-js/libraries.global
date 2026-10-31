import { AtlasLibraryDensity } from "@/components/atlas/AtlasLibraryDensity"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import { densitySettings, densityData } from "../../fixtures/geography/atlas"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <AtlasLibraryDensity
            {...args}
            onSettings={(settings) => {
              args.onSettings?.(settings)
              updateArgs({ settings })
            }}
            onPins={() => {
              args.onPins?.()
              updateArgs({ pins: !args.pins })
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
  title: "Features/Atlas/AtlasLibraryDensity",
  component: AtlasLibraryDensity,
  args: {
    data: densityData,
    settings: densitySettings,
    onSettings: fn(),
    selected: null,
    pins: true,
    onPins: fn(),
    onResults: fn(),
    centre: { lat: 51.5, lng: -0.1 },
    retry: fn(),
  },
} satisfies Meta<typeof AtlasLibraryDensity>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Loading: Story = { args: { loading: true } }
export const Unavailable: Story = {
  args: { error: "The density layer is unavailable." },
}
