import { AtlasPlansSheet } from "@/components/atlas/AtlasPlansSheet"
import { Button } from "@/components/ui/button"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  title: "Features/Atlas/AtlasPlansSheet",
  component: AtlasPlansSheet,
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <>
            <Button onClick={() => updateArgs({ open: true })}>
              Compare plans
            </Button>
            <AtlasPlansSheet
              {...args}
              onClose={() => {
                args.onClose()
                updateArgs({ open: false })
              }}
            />
          </>
        )}
      </InteractiveArgs>
    )
  },
  args: {
    open: false,
    tier: "public",
    onClose: fn(),
    signInHref: "/auth/signin",
  },
  parameters: {
    fixtureResponses: geographyResponses,
  },
} satisfies Meta<typeof AtlasPlansSheet>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Open: Story = {
  args: { open: true },
  parameters: { docs: { story: { inline: false, height: "650px" } } },
}
