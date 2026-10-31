import AtlasFeedbackFields from "@/components/contact/AtlasFeedbackFields"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Contact/AtlasFeedbackFields",
  component: AtlasFeedbackFields,
  args: {
    features: [],
    featureError: false,
    firstFeatureRef: { current: null },
    clarity: undefined,
    setFeatures: fn(),
    setClarity: fn(),
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs()

    return (
      <InteractiveArgs args={args} onUpdate={updateArgs}>
        {(live, update) => (
          <AtlasFeedbackFields
            {...live}
            setFeatures={(features) => {
              live.setFeatures(features)
              update({ features })
            }}
            setClarity={(clarity) => {
              live.setClarity(clarity)
              update({ clarity })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 640, display: "grid", gap: 24 }}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof AtlasFeedbackFields>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const RequiredSelection: Story = { args: { featureError: true } }
