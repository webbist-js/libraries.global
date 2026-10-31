import { FooterSocialIcon } from "@/components/global/FooterSocialIcon"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Global/FooterSocialIcon",
  component: FooterSocialIcon,
  args: {},
} satisfies Meta<typeof FooterSocialIcon>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
