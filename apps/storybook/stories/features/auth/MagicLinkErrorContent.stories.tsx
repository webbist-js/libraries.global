import { MagicLinkErrorContent } from "@/app/[locale]/auth/magic-link/_components/MagicLinkErrorContent"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Auth/MagicLinkErrorContent",
  component: MagicLinkErrorContent,
  args: { error: "expired" },
  parameters: { docs: { story: { inline: false, height: "760px" } } },
} satisfies Meta<typeof MagicLinkErrorContent>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
