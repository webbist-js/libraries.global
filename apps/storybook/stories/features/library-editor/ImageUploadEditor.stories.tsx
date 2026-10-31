import { ImageUploadEditor } from "@/components/library-editor/ImageUploadEditor"
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
          <ImageUploadEditor
            {...args}
            onChange={(images) => {
              args.onChange?.(images)
              updateArgs({ images })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },

  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Library editor/ImageUploadEditor",
  component: ImageUploadEditor,
  args: {
    images: [{ strapiId: 1, url: "/library-placeholder.svg", isHero: true }],
    onChange: fn(),
  },
} satisfies Meta<typeof ImageUploadEditor>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { images: [] } }
