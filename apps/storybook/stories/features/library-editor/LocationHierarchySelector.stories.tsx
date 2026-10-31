import { LocationHierarchySelector } from "@/components/library-editor/LocationHierarchySelector"
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
          <LocationHierarchySelector
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
  title: "Features/Library editor/LocationHierarchySelector",
  component: LocationHierarchySelector,
  args: { f: wizardForm, setFormData: fn() },
} satisfies Meta<typeof LocationHierarchySelector>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
