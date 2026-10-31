import { FeedsAside } from "@/app/[locale]/(dashboard)/staff/[slug]/events/_components/FeedsAside"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Staff/FeedsAside",
  component: FeedsAside,
  args: {},
} satisfies Meta<typeof FeedsAside>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
