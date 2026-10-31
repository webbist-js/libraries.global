import { AtlasInspect } from "@/components/atlas/AtlasInspect"
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
          <AtlasInspect
            {...args}
            onSelect={(active) => {
              args.onSelect?.(active)
              updateArgs({ active })
            }}
            onMinimise={() => {
              args.onMinimise?.()
              updateArgs({ minimised: !args.minimised })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },

  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/AtlasInspect",
  component: AtlasInspect,
  args: {
    entries: [
      {
        id: "example-entry",
        label: "Library access",
        title: "Northbridge",
        detail: "Two recorded libraries",
        content: <p>Review the example district’s library access.</p>,
      },
    ],
    active: "example-entry",
    minimised: false,
    onSelect: fn(),
    onMinimise: fn(),
    onRemove: fn(),
  },
  decorators: [
    (Story) => (
      <div className="relative min-h-[600px] max-w-4xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AtlasInspect>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Minimised: Story = { args: { minimised: true } }
