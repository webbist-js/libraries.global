import { ContactForm } from "@/components/elementary/forms/ContactForm"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Contact/Legacy contact form",
  component: ContactForm,
  args: { gdpr: { href: "/legal/privacy", label: "Privacy notice" } },
  parameters: {
    serverFixtures: {
      "cms.public.fetchAPI": {
        data: {
          id: 1,
          documentId: "example-contact-submission",
          name: "Maya Example",
          email: "maya@example.invalid",
          message: "A synthetic enquiry submitted within Storybook.",
        },
        meta: {},
      },
    },
    docs: {
      description: {
        component:
          "The legacy contact form uses the real form hook, a synchronous CMS endpoint lookup and local fixture transport. Example submissions remain within Storybook.",
      },
    },
  },
} satisfies Meta<typeof ContactForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
