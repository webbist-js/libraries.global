import { ProFaq } from "@/app/[locale]/(dashboard)/contribute/_components/membership/ProFaq"
import { ContactModalProvider } from "@/components/contact/ContactModalProvider"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import type { ComponentProps } from "react"

type Args = NonNullable<ComponentProps<typeof ProFaq>>

const meta = {
  title: "Features/Membership/ProFaq",
  component: ProFaq,
  decorators: [
    (Story) => (
      <ContactModalProvider>
        <Story />
      </ContactModalProvider>
    ),
  ],
  args: {},
} satisfies Meta<Args>

export default meta
type Story = StoryObj<NonNullable<ComponentProps<typeof ProFaq>>>

export const Default: Story = {}
