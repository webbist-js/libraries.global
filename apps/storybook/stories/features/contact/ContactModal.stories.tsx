import ContactModal from "@/components/contact/ContactModal"
import { Button } from "@/components/ui/button"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Contact/Contact modal",
  component: ContactModal,
  args: {
    intent: { mode: "contact", type: "general_inquiry" },
    context: { page: "/libraries", locale: "en" },
    trigger: null,
    open: false,
    onClose: fn(),
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
    docs: {
      description: {
        component:
          "The real contact dialog with synthetic local transport. Submitting this example does not send a message." +
          " This example runs in its own iframe to keep fixture requests, caches and page landmarks independent. Open Canvas to use the interactive Controls.",
      },
    },
  },
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <>
            <Button
              variant="surface"
              onClick={() => updateArgs({ open: true })}
            >
              Open contact form
            </Button>
            <ContactModal
              {...args}
              onClose={() => {
                args.onClose()
                updateArgs({ open: false })
              }}
            />
          </>
        )}
      </InteractiveArgs>
    )
  },
} satisfies Meta<typeof ContactModal>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Open: Story = {
  args: { open: true },
  parameters: { docs: { story: { inline: false, height: "720px" } } },
}
export const Feedback: Story = {
  args: { open: true, intent: { mode: "feedback" } },
  parameters: { docs: { story: { inline: false, height: "720px" } } },
}
export const AtlasFeedback: Story = {
  args: { open: true, intent: { mode: "feedback", product: "atlas" } },
  parameters: { docs: { story: { inline: false, height: "720px" } } },
}
