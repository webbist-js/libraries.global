import { ModerationHero } from "@/app/[locale]/(dashboard)/moderation/_components/ModerationHero"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Moderation/ModerationHero",
  component: ModerationHero,
  args: {
    title: "Review contributions",
    lead: "Check public sources and help keep library information reliable.",
  },
} satisfies Meta<typeof ModerationHero>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
