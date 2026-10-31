import { Chip } from "@/components/atlas/atlas-ui"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/Chip",
  component: Chip,
  args: { on: false, onClick: fn(), children: "Public libraries", count: 24 },
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <Chip
            {...args}
            onClick={() => {
              args.onClick()
              updateArgs({ on: !args.on })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },
} satisfies Meta<typeof Chip>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
