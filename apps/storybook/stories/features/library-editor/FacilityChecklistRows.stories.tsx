import { FacilityChecklistRows } from "@/components/library-editor/FacilityChecklistRows"
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
          <FacilityChecklistRows
            {...args}
            setFormData={(next) => {
              const f = typeof next === "function" ? next(args.f) : next
              args.setFormData(f)
              updateArgs({ f })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },

  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Library editor/FacilityChecklistRows",
  component: FacilityChecklistRows,
  args: { f: wizardForm, setFormData: fn() },
} satisfies Meta<typeof FacilityChecklistRows>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
