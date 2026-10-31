import { CommunityNavBar } from "@/app/[locale]/(dashboard)/community/_components/CommunityNavBar"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Community/CommunityNavBar",
  component: CommunityNavBar,
  args: { counts: { noticeboard: 3, suggestions: 8 } },
  parameters: {
    nextjs: { navigation: { pathname: "/community/discussions" } },
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof CommunityNavBar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const NoCounts: Story = { args: { counts: {} } }
