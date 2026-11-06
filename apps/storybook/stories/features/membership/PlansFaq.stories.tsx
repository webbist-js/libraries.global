import { PlansFaq } from "@/app/[locale]/(dashboard)/contribute/_components/membership/PlansFaq"
import { ContactModalProvider } from "@/components/contact/ContactModalProvider"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import type { ComponentProps } from "react"

type Args = NonNullable<ComponentProps<typeof PlansFaq>>

const meta = {
  title: "Features/Membership/PlansFaq",
  component: PlansFaq,
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
type Story = StoryObj<NonNullable<ComponentProps<typeof PlansFaq>>>

export const Default: Story = {}
