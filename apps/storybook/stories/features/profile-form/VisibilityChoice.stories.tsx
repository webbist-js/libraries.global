import { VisibilityChoice } from "@/components/profile-form/ProfileSections"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useId } from "react"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"

const meta = {
  title: "Features/Profile form/VisibilityChoice",
  component: VisibilityChoice,
  args: {
    value: "public",
    labelledBy: "example-visibility-heading",
    describedBy: "example-visibility-help",
    onChange: fn(),
  },
  render: function Example(supplied) {
    const id = useId()
    const [, sync] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={sync}>
        {(args, update) => (
          <section className="max-w-xl">
            <h2 id={`${id}-title`}>Profile visibility</h2>
            <p id={`${id}-help`}>Choose who can see your profile.</p>
            <VisibilityChoice
              {...args}
              labelledBy={`${id}-title`}
              describedBy={`${id}-help`}
              onChange={(value) => {
                args.onChange(value)
                update({ value })
              }}
            />
          </section>
        )}
      </InteractiveArgs>
    )
  },
  parameters: { docs: { story: { inline: false, height: "900px" } } },
} satisfies Meta<typeof VisibilityChoice>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
