import { NewsletterForm } from "@/components/elementary/forms/NewsletterForm"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Contact/Newsletter form",
  component: NewsletterForm,
  parameters: {
    fixtureResponses: { "POST /api/newsletter": { body: { success: true } } },
  },
} satisfies Meta<typeof NewsletterForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
