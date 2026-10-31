import { ContactDetails } from "@/components/contact/ContactFields"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Contact/ContactDetails",
  component: ContactDetails,
  args: {
    feedback: false,
    atlas: false,
    type: "general_inquiry",
    topic: "experience",
    task: "",
    intent: { mode: "contact", type: "general_inquiry" },
    context: { page: "/libraries", locale: "en" },
    messageRef: { current: null },
    message: "",
    wishlist: "",
    steps: "",
    name: "Maya Example",
    email: "maya@example.invalid",
    setType: fn(),
    setMessage: fn(),
    setWishlist: fn(),
    setSteps: fn(),
    setName: fn(),
    setEmail: fn(),
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs()

    return (
      <InteractiveArgs args={args} onUpdate={updateArgs}>
        {(live, update) => (
          <ContactDetails
            {...live}
            setType={(type) => {
              live.setType(type)
              update({ type })
            }}
            setMessage={(message) => {
              live.setMessage(message)
              update({ message })
            }}
            setWishlist={(wishlist) => {
              live.setWishlist(wishlist)
              update({ wishlist })
            }}
            setSteps={(steps) => {
              live.setSteps(steps)
              update({ steps })
            }}
            setName={(name) => {
              live.setName(name)
              update({ name })
            }}
            setEmail={(email) => {
              live.setEmail(email)
              update({ email })
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
} satisfies Meta<typeof ContactDetails>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const ReportProblem: Story = { args: { type: "report_issue" } }
export const Feedback: Story = {
  args: { feedback: true, topic: "idea", intent: { mode: "feedback" } },
}
