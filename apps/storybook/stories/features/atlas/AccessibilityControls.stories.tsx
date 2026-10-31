import { AccessibilityControls } from "@/components/atlas/AtlasAccessibility"
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
          <AccessibilityControls
            {...args}
            onChange={(view) => {
              args.onChange?.(view)
              updateArgs({ view })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },

  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/AccessibilityControls",
  component: AccessibilityControls,
  args: {
    view: "matches",
    onChange: fn(),
    coverage: { total: 24, matches: 18, partial: 2, unconfirmed: 4 },
    scope: "Northbridge",
  },
} satisfies Meta<typeof AccessibilityControls>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
