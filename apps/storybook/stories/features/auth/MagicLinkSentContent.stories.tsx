import { MagicLinkSentContent } from "@/app/[locale]/auth/magic-link-sent/_components/MagicLinkSentContent"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Auth/MagicLinkSentContent",
  component: MagicLinkSentContent,
  args: {},
  parameters: { docs: { story: { inline: false, height: "760px" } } },
} satisfies Meta<typeof MagicLinkSentContent>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
