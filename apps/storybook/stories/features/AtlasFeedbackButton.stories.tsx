import { AtlasFeedbackButton } from "@/components/atlas/AtlasFeedbackButton"
import { ContactModalProvider } from "@/components/contact/ContactModalProvider"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Atlas/AtlasFeedbackButton",
  component: AtlasFeedbackButton,
  args: {},
  decorators: [
    (Story) => (
      <ContactModalProvider>
        <Story />
      </ContactModalProvider>
    ),
  ],
} satisfies Meta<typeof AtlasFeedbackButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
