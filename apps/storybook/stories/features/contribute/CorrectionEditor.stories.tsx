import { CorrectionEditor } from "@/components/contribute/CorrectionEditor"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import {
  driveCorrectionRecord,
  driveCorrectionWithHours,
} from "../../fixtures/public/drives"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Contribute/CorrectionEditor",
  component: CorrectionEditor,
  args: {
    category: "Opening hours",
    current: driveCorrectionRecord,
    edit: {},
    onChange: fn(),
    onNames: fn(),
    changedKeys: [],
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs()

    return (
      <InteractiveArgs args={args} onUpdate={updateArgs}>
        {(live, update) => (
          <CorrectionEditor
            {...live}
            onChange={(edit) => {
              live.onChange(edit)
              update({ edit, changedKeys: Object.keys(edit) })
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
} satisfies Meta<typeof CorrectionEditor>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const CurrentHours: Story = {
  args: { current: driveCorrectionWithHours },
}
export const Address: Story = { args: { category: "Address or location" } }
export const Contact: Story = { args: { category: "Website or catalogue" } }
export const Facilities: Story = {
  args: { category: "Services and facilities" },
}
