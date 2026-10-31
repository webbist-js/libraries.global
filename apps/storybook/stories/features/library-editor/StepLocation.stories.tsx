import { StepLocation } from "@/components/library-editor/StepLocation"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import { wizardForm } from "../../fixtures/geography/mobile"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <StepLocation
            {...args}
            setFormData={(next) => {
              const f = typeof next === "function" ? next(args.f) : next
              args.setFormData(f)
              updateArgs({ f })
            }}
            set={(key, value) => {
              args.set(key, value)
              updateArgs({ f: { ...args.f, [key]: value } })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },

  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Library editor/StepLocation",
  component: StepLocation,
  args: { f: wizardForm, set: fn(), setFormData: fn() },
} satisfies Meta<typeof StepLocation>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
