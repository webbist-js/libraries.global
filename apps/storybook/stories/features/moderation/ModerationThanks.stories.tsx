import { ModerationThanks } from "@/app/[locale]/(dashboard)/moderation/_components/ModerationThanks"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Moderation/ModerationThanks",
  component: ModerationThanks,
} satisfies Meta<typeof ModerationThanks>

export default meta
type Story = StoryObj<typeof meta>

export const Guides: Story = {}
