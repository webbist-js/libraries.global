import { ProfileAppearance } from "@/components/settings/ProfileAppearance"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../.storybook/InteractiveArgs"

const meta = {
  title: "Features/Settings/ProfileAppearance",
  component: ProfileAppearance,
  args: { background: "violet", onBackgroundChange: fn() },
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <ProfileAppearance
            {...args}
            onBackgroundChange={(background) => {
              args.onBackgroundChange(background)
              updateArgs({ background })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },
} satisfies Meta<typeof ProfileAppearance>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Mint: Story = { args: { background: "mint" } }
