import { BadgeTile } from "@/app/[locale]/profile/[username]/_components/ProfileSectionUI"
import { BADGE_CATALOG } from "@/lib/badges"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Profile/BadgeTile",
  component: BadgeTile,
  args: {
    badge: BADGE_CATALOG[0]!,
    earned: true,
    awardedLabel: "January 2026",
    showRarity: true,
  },
  parameters: { docs: { story: { inline: false, height: "900px" } } },
  render: (args) => (
    <ul className="m-0 max-w-xl list-none p-0">
      <BadgeTile {...args} />
    </ul>
  ),
} satisfies Meta<typeof BadgeTile>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Locked: Story = { args: { earned: false, awardedLabel: null } }
