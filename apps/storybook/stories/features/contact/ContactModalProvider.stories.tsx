import {
  ContactModalProvider,
  useContactModal,
} from "@/components/contact/ContactModalProvider"
import { Button } from "@/components/ui/button"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

function ContactActions() {
  const contact = useContactModal()

  return (
    <div className="flex flex-wrap gap-3">
      <Button variant="surface" onClick={() => contact.openFeedback()}>
        Give feedback
      </Button>
      <Button variant="surface" onClick={() => contact.openAtlasFeedback()}>
        Atlas feedback
      </Button>
      <Button
        variant="surface"
        onClick={() => contact.openContact("account_support")}
      >
        Account support
      </Button>
    </div>
  )
}
const meta = {
  title: "Features/Contact/Modal provider",
  component: ContactModalProvider,
  args: { children: <ContactActions /> },
  parameters: {
    docs: {
      story: { inline: false, iframeHeight: 900 },
      description: {
        component:
          "This example runs in its own iframe to keep fixture requests, caches and page landmarks independent. Open Canvas to use the interactive Controls.",
      },
    },
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof ContactModalProvider>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
