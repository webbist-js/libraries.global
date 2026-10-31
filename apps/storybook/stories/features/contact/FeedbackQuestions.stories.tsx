import { FeedbackQuestions } from "@/components/contact/ContactFields"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Contact/FeedbackQuestions",
  component: FeedbackQuestions,
  args: {
    atlas: false,
    topic: "experience",
    task: "",
    outcome: "",
    ease: undefined,
    setTopic: fn(),
    setTask: fn(),
    setOutcome: fn(),
    setEase: fn(),
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs()

    return (
      <InteractiveArgs args={args} onUpdate={updateArgs}>
        {(live, update) => (
          <FeedbackQuestions
            {...live}
            setTopic={(topic) => {
              live.setTopic(topic)
              update({ topic })
            }}
            setTask={(task) => {
              live.setTask(task)
              update({ task })
            }}
            setOutcome={(outcome) => {
              live.setOutcome(outcome)
              update({ outcome })
            }}
            setEase={(ease) => {
              live.setEase(ease)
              update({ ease })
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
} satisfies Meta<typeof FeedbackQuestions>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Atlas: Story = { args: { atlas: true } }
export const Problem: Story = { args: { topic: "problem" } }
