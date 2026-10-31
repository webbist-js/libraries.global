import { PhotoUpload } from "@/components/contribute/PhotoUpload"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Contribute/PhotoUpload",
  component: PhotoUpload,
  args: { photo: null, onChange: fn() },
  render: function Render(args) {
    const [, updateArgs] = useArgs()

    return (
      <InteractiveArgs args={args} onUpdate={updateArgs}>
        {(live, update) => (
          <PhotoUpload
            {...live}
            onChange={(photo) => {
              live.onChange(photo)
              update({ photo })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
    docs: {
      story: { inline: false, iframeHeight: 800 },
      description: {
        component:
          "This example uses its own iframe to keep fixture transport and panel state independent. Open Canvas for interactive Controls.",
      },
    },
  },
} satisfies Meta<typeof PhotoUpload>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Uploaded: Story = {
  args: { photo: { id: 1, url: "/library-placeholder.svg" } },
}
