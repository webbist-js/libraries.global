import { StaffVerifyButton } from "@/app/[locale]/(dashboard)/staff/_components/StaffVerifyButton"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Staff/StaffVerifyButton",
  component: StaffVerifyButton,
  args: { id: "example-library", sections: ["hours"] },
  parameters: {
    fixtureResponses: {
      "POST /api/staff/example-library/verify": { body: { ok: true } },
    },
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof StaffVerifyButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
