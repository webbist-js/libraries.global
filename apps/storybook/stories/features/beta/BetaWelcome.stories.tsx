import BetaWelcome from "@/components/beta/BetaWelcome"
import { BetaWelcomeMount } from "@/components/beta/BetaWelcomeMount"
import { ContactModalProvider } from "@/components/contact/ContactModalProvider"
import { Button } from "@/components/ui/button"
import { BETA_WELCOME_KEY } from "@/lib/beta/welcome"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { readerSession } from "../../../.storybook/FixtureSession"
import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"

const meta = {
  title: "Features/Beta/Welcome",
  component: BetaWelcome,
  args: { sandbox: true, open: false, onClose: fn() },
  parameters: {
    fixtureSession: readerSession,
    docs: { story: { inline: false, height: "960px" } },
  },
  render: function Example(supplied) {
    const [, sync] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={sync}>
        {(args, update) => (
          <ContactModalProvider>
            <Button onClick={() => update({ open: true })}>
              Open beta welcome
            </Button>
            <BetaWelcome
              {...args}
              onClose={() => {
                args.onClose()
                update({ open: false })
              }}
            />
          </ContactModalProvider>
        )}
      </InteractiveArgs>
    )
  },
} satisfies Meta<typeof BetaWelcome>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Open: Story = { args: { open: true } }
export const MountedVisit: Story = {
  beforeEach: () => {
    const previous = sessionStorage.getItem(BETA_WELCOME_KEY)
    sessionStorage.removeItem(BETA_WELCOME_KEY)

    return () => {
      if (previous === null) sessionStorage.removeItem(BETA_WELCOME_KEY)
      else sessionStorage.setItem(BETA_WELCOME_KEY, previous)
    }
  },
  render: () => (
    <ContactModalProvider>
      <BetaWelcomeMount sandbox />
    </ContactModalProvider>
  ),
}
