import { ModerationAccessUnavailable } from "@/app/[locale]/(dashboard)/moderation/_components/ModerationAccessUnavailable"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Moderation/ModerationAccessUnavailable",
  component: ModerationAccessUnavailable,
  args: { title: "Review contributions", path: "/moderation" },
} satisfies Meta<typeof ModerationAccessUnavailable>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
